import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import fs from 'fs';
import https from 'https';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Replicate from 'replicate';
import { execSync } from 'child_process';
import {
  GEMINI_MODELS,
  REPLICATE_DEPLOYMENTS,
  MEDITATION_TYPE_LABELS,
  DEFAULT_MEDITATION_TYPE,
  normalizeMeditationType,
  buildBackgroundMeditationTitlePrompt,
  buildMeditationScriptPrompt
} from './config/ai.js';
import { concatenateAudioBuffers, generateSilenceBuffer, transcodeAudioBuffer, getWavDurationSeconds, convertAudioToWav, normalizeWavBuffer } from './utils/audio.js';
import {
  onesignalEnabled,
  sendOneSignalNotification,
  updateOneSignalUser,
  sendOneSignalEvent,
  fetchOneSignalUserByExternalId,
} from './utils/onesignal.js';
import { attachEntitlements } from './middleware/entitlements.js';
import { incrementUsageCounters } from './utils/quota.js';
import { extractAudioUrlFromPrediction } from './utils/replicate.js';

function createSilenceBuffer(durationSeconds = 0.35) {
  const buffer = generateSilenceBuffer(durationSeconds);
  console.log(`🔇 Generated ${durationSeconds}s silence buffer: ${buffer.length} bytes`);
  return buffer;
}

function mergeAudioBuffers(buffers = []) {
  console.log(`🔗 Starting concatenation of ${buffers.length} audio buffers...`);

  if (buffers.length === 0) {
    console.log('⚠️ No buffers to concatenate');
    return Buffer.alloc(0);
  }

  if (buffers.length === 1) {
    console.log(`ℹ️ Only one buffer, returning as-is: ${buffers[0].length} bytes`);
    return Buffer.from(buffers[0]);
  }

  const result = concatenateAudioBuffers(buffers);
  console.log(`✅ Audio concatenation complete: ${result.length} bytes`);
  return result;
}

function resolveVoiceSettings(_reflectionType) {
  return { voice: 'af_nicole', speed: 0.7 };
}

const AUDIO_AVAILABILITY_WINDOW_MS = 24 * 60 * 60 * 1000;
const PAUSE_TOKEN_PATTERN = '\\[\\s*pause\\s*(?:=|:)\\s*(\\d+)\\s*(?:s(?:ec(?:onds?)?)?)?\\s*\\]';

function splitScriptIntoSegments(script) {
  if (typeof script !== 'string' || script.length === 0) {
    return [''];
  }

  const regex = new RegExp(PAUSE_TOKEN_PATTERN, 'gi');
  const segments = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(script)) !== null) {
    segments.push(script.slice(lastIndex, match.index));
    segments.push(match[1] ?? '');
    lastIndex = match.index + match[0].length;
  }

  segments.push(script.slice(lastIndex));
  return segments;
}

const extractJson = (rawText) => {
  if (!rawText) return null;
  try {
    const trimmed = rawText.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return JSON.parse(trimmed);
    }

    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
  } catch (error) {
    console.error('Failed to parse Gemini JSON response (worker):', error);
  }
  return null;
};

const limitSentences = (text, maxSentences) => {
  if (!text) return '';
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  const sentences = cleaned.match(/[^.!?]+[.!?]?/g) || [];
  return sentences.slice(0, maxSentences).join(' ').trim();
};

async function generateTitleAndSummary(script, reflectionType, fallbackTitle) {
  const normalizedType = normalizeMeditationType(reflectionType);
  const label = MEDITATION_TYPE_LABELS[normalizedType] || 'Meditation';
  const fallbackSummary = `Guided ${label.toLowerCase()} session based on personal reflections.`;
  const prompt = buildBackgroundMeditationTitlePrompt(script);

  try {
    const model = gemini.getGenerativeModel({ model: GEMINI_MODELS.default });
    const result = await model.generateContent(prompt);
    const rawText = result.response.text();
    const parsed = extractJson(rawText) || {};

    const titleCandidate = typeof parsed.title === 'string' ? parsed.title.trim() : '';
    const summaryCandidate = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';

    const resolvedTitle = titleCandidate || fallbackTitle;
    const resolvedSummary = limitSentences(summaryCandidate, 3) || fallbackSummary;

    return {
      title: resolvedTitle,
      summary: resolvedSummary
    };
  } catch (error) {
    console.error('Worker failed to generate meditation title/summary:', error);
    return {
      title: fallbackTitle,
      summary: fallbackSummary
    };
  }
}

// FFmpeg path resolution utility for Railway deployment
function getFFmpegPath() {
  try {
    // On Railway/production, ffmpeg may be installed but not in PATH
    // Use 'which' to find the full path dynamically
    const isProduction = process.env.NODE_ENV === 'production';
    const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID;
    
    if (isProduction || isRailway) {
      const ffmpegPath = execSync('which ffmpeg', { 
        encoding: 'utf8',
        timeout: 5000 // 5 second timeout
      }).trim();
      
      if (ffmpegPath && ffmpegPath !== '') {
        console.log(`🔧 Found ffmpeg at: ${ffmpegPath}`);
        return ffmpegPath;
      } else {
        console.warn('⚠️ which command returned empty path for ffmpeg');
      }
    }
  } catch (error) {
    console.warn('⚠️ Could not resolve ffmpeg path via which command:', error.message);
    console.warn('🔍 Current PATH:', process.env.PATH);
    
    // Try alternative approaches for Railway
    if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID) {
      try {
        // Try common Railway paths
        const commonPaths = ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/bin/ffmpeg'];
        for (const testPath of commonPaths) {
          try {
            execSync(`test -f ${testPath}`, { timeout: 1000 });
            console.log(`🔧 Found ffmpeg at alternative path: ${testPath}`);
            return testPath;
          } catch (_testError) {
            // Path doesn't exist, continue
          }
        }
      } catch (altError) {
        console.warn('⚠️ Alternative ffmpeg path search failed:', altError.message);
      }
    }
  }
  
  // Fallback to default 'ffmpeg' for local development
  console.log('🏠 Using default ffmpeg command for local development');
  return 'ffmpeg';
}

// Get current directory (ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import middleware
import { requireAuth, supabase } from './middleware/auth.js';
import { registerNotesRoutes } from './routes/notes.js';
import { registerMeditationRoutes } from './routes/meditations.js';
import { registerProfileRoutes } from './routes/profile.js';
import { registerFileRoutes } from './routes/files.js';
import { registerStatsRoutes } from './routes/stats.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerAccountRoutes } from './routes/account.js';
import { registerProgressRoutes } from './routes/progress.js';
import { registerSubscriptionRoutes } from './routes/subscription.js';
import createWeeklyReportWorker from './workers/weeklyReportWorker.js';
import { createWeeklyReportReminderWorker } from './workers/weeklyReportReminderWorker.js';

// Initialize AI services
const gemini = globalThis.__REPLAY_TEST_GEMINI__ ?? new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const replicateClient = globalThis.__REPLAY_TEST_REPLICATE__ ?? new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});
const weeklyReportWorker = createWeeklyReportWorker({
  supabase,
  gemini
});
const weeklyReportReminderWorker = createWeeklyReportReminderWorker({
  supabase
});

async function transcodeMeditationAudio(buffer, context = {}) {
  if (typeof globalThis.__REPLAY_TEST_TRANSCODE__ === 'function') {
    return globalThis.__REPLAY_TEST_TRANSCODE__(buffer, context);
  }

  try {
    const ffmpegPath = getFFmpegPath();
    const compressed = await transcodeAudioBuffer(buffer, { ffmpegPath, format: 'mp3' });
    return {
      buffer: compressed,
      contentType: 'audio/mpeg',
      extension: 'mp3'
    };
  } catch (error) {
    console.warn('Audio transcode failed, using WAV fallback:', error.message);
    return {
      buffer,
      contentType: 'audio/wav',
      extension: 'wav'
    };
  }
}

// Initialize Express app
const app = express();

// When running behind a proxy (Railway, Vercel, etc.) ensure Express trusts the
// forwarded headers so rate limiting and IP checks work correctly.
const shouldTrustProxy = process.env.TRUST_PROXY ?? (process.env.NODE_ENV === 'production' ? '1' : '0');
if (shouldTrustProxy !== '0' && shouldTrustProxy !== 'false') {
  app.set('trust proxy', shouldTrustProxy === '1' ? 1 : shouldTrustProxy);
}
const PORT = process.env.PORT || 3001;

// Background job processing system
let jobWorkerInterval = null;
let weeklyReportInterval = null;
let weeklyReportReminderInterval = null;

// Background worker functions
async function processMeditationJob(job) {
  try {
    console.log(`🔄 Starting background processing for job ${job.id}`);
    
    // Mark job as processing
    await supabase
      .from('meditation_jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .eq('id', job.id);

    // Extract job parameters
    const { 
      note_ids: noteIds, 
      duration: jobDuration, 
      reflection_type: reflectionType,
      user_id: userId 
    } = job;
    const parsedDuration = typeof jobDuration === 'number' ? jobDuration : parseInt(jobDuration, 10);
    const duration = Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 5;
    const normalizedReflectionType = normalizeMeditationType(reflectionType || DEFAULT_MEDITATION_TYPE);

    // Generate meditation using existing meditation logic
    // Get selected notes and user profile (same as synchronous version)
    const { data: notes, error: notesError } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .in('id', noteIds);

    if (notesError) {
      throw new Error(`Failed to fetch notes: ${notesError.message}`);
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('name, values, mission, thinking_about')
      .eq('user_id', userId)
      .single();

    // Generate custom meditation using the selected reflection type
    const model = gemini.getGenerativeModel({ model: GEMINI_MODELS.default });
    
    // Build experience text from notes
    const experiencesText = notes.map(note => {
      let noteContent = note.transcript;
      if (note.type === 'photo' && note.original_caption && note.ai_image_description) {
        noteContent = `${note.original_caption} [AI_ANALYSIS: ${note.ai_image_description}]`;
      } else if (note.type === 'photo' && note.original_caption && !note.ai_image_description) {
        noteContent = note.original_caption;
      } else if (note.type === 'photo' && !note.original_caption && note.ai_image_description) {
        noteContent = `[AI_ANALYSIS: ${note.ai_image_description}]`;
      }
      return `${note.date}: ${note.title}\n${noteContent}`;
    }).join('\n\n---\n\n');

    const profileContext = profile ? `
      User's name: ${profile.name || 'User'}
      Personal values: ${profile.values || 'Not specified'}
      Life mission: ${profile.mission || 'Not specified'}
      Currently thinking about/working on: ${profile.thinking_about || 'Not specified'}
    ` : '';

    // Use shared audio helpers for silence generation and concatenation

    const scriptPrompt = buildMeditationScriptPrompt({
      reflectionType: normalizedReflectionType,
      duration,
      profileContext,
      experiencesText
    });
    const result = await model.generateContent(scriptPrompt);
    const script = result.response.text();
    const typeLabel = MEDITATION_TYPE_LABELS[normalizedReflectionType] || 'General Meditation';
    const fallbackTitle = `${typeLabel} - ${new Date().toLocaleDateString()}`;
    const { title: generatedTitle, summary: generatedSummary } = await generateTitleAndSummary(
      script,
      normalizedReflectionType,
      fallbackTitle
    );

    // Generate TTS and process audio (simplified for background processing)
    const meditationId = uuidv4();
    const audioExpiresAt = new Date(Date.now() + AUDIO_AVAILABILITY_WINDOW_MS);
    const segments = splitScriptIntoSegments(script);
    const tempDir = path.join(__dirname, 'temp', meditationId);
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempAudioFiles = [];
    const ttsDeployment = REPLICATE_DEPLOYMENTS.tts;
    const voiceSettings = resolveVoiceSettings(normalizedReflectionType);
    const playbackSpeed = typeof voiceSettings.speed === 'number' && voiceSettings.speed > 0 ? voiceSettings.speed : 1;
    const ffmpegPathForSegments = getFFmpegPath();

    // Process segments for TTS
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i].trim();
      
      if (segment && isNaN(segment)) {
        // Speech segment - generate TTS
        try {
          const replicateInput = {
            text: segment,
            voice: voiceSettings.voice,
            speed: voiceSettings.speed
          };

          console.log('📤 Replicate deployment call:', {
            owner: ttsDeployment.owner,
            name: ttsDeployment.name,
            input: replicateInput
          });

          const prediction = await replicateClient.deployments.predictions.create(
            ttsDeployment.owner,
            ttsDeployment.name,
            { input: replicateInput }
          );
          const completed = await replicateClient.wait(prediction);
          const audioUrl = extractAudioUrlFromPrediction(completed);

          console.log('📥 Replicate deployment response:', { audioUrl });
          const audioResponse = await fetch(audioUrl);
          const arrayBuffer = await audioResponse.arrayBuffer();
          let audioBuffer = Buffer.from(arrayBuffer);

          try {
            audioBuffer = await convertAudioToWav(audioBuffer, {
              ffmpegPath: ffmpegPathForSegments,
              playbackSpeed,
              inputFormat: 'auto'
            });
            audioBuffer = normalizeWavBuffer(audioBuffer);
          } catch (conversionError) {
            const message = conversionError instanceof Error ? conversionError.message : String(conversionError);
            console.warn(`⚠️ Failed to convert segment ${i} audio to WAV:`, message);
            // Fall back to generating silence to avoid corrupt buffers downstream.
            audioBuffer = createSilenceBuffer(Math.max(3, Math.ceil(segment.length / 20)));
          }

          const tempFileName = path.join(tempDir, `segment-${i}-speech.wav`);
          fs.writeFileSync(tempFileName, audioBuffer);
          tempAudioFiles.push(tempFileName);

        } catch (ttsError) {
          console.error(`TTS failed for segment ${i}:`, ttsError);
          // Create meaningful pause based on text length (better UX than tiny silence) - using buffer approach
          const pauseDuration = Math.max(3, Math.ceil(segment.length / 20)); // ~3 seconds minimum, estimate reading time
          const silenceBuffer = createSilenceBuffer(pauseDuration);
          const tempFileName = path.join(tempDir, `segment-${i}-speech.wav`);
          fs.writeFileSync(tempFileName, silenceBuffer);
          tempAudioFiles.push(tempFileName);
          console.log(`📝 TTS fallback: Created ${pauseDuration}s pause for "${segment.substring(0, 50)}..."`);
        }
      } else if (!isNaN(segment)) {
        // Pause segment - using buffer approach instead of ffmpeg
        let pauseDuration = parseInt(segment);
        if (isNaN(pauseDuration) || pauseDuration <= 0) {
          console.log(`⚠️ Invalid pause duration: ${segment}, using 3 seconds default`);
          pauseDuration = 3;
        }
        const silenceBuffer = createSilenceBuffer(pauseDuration);
        const tempFileName = path.join(tempDir, `segment-${i}-pause.wav`);
        fs.writeFileSync(tempFileName, silenceBuffer);
        tempAudioFiles.push(tempFileName);
      }
    }

    const audioBuffers = tempAudioFiles.map(filePath => fs.readFileSync(filePath));
    const finalAudioBuffer = mergeAudioBuffers(audioBuffers);
    const measuredDurationSeconds = Math.round(getWavDurationSeconds(finalAudioBuffer));

    const audioResult = await transcodeMeditationAudio(finalAudioBuffer, { reflectionType: normalizedReflectionType, duration });
    const finalAudioFileName = `${meditationId}-complete.${audioResult.extension}`;
    const storagePath = `${userId}/${finalAudioFileName}`;
    
    const { error: audioError } = await supabase.storage
      .from('meditations')
      .upload(storagePath, audioResult.buffer, {
        contentType: audioResult.contentType,
        upsert: false
      });

    let signedAudioUrl = null;
    if (!audioError) {
      const { data: signedUrlData } = await supabase.storage
        .from('meditations')
        .createSignedUrl(storagePath, Math.min(3600 * 24, AUDIO_AVAILABILITY_WINDOW_MS / 1000));
      signedAudioUrl = signedUrlData?.signedUrl ?? null;
    }

    // Create playlist and calculate duration
    const storagePlaylist = [{
      type: 'continuous',
      audioUrl: audioError ? null : (signedAudioUrl ?? storagePath),
      duration: 0
    }];

    let totalDuration = measuredDurationSeconds;
    let estimatedDuration = 0;
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i].trim();
      if (segment && isNaN(segment)) {
        estimatedDuration += Math.ceil(segment.length / 10);
      } else if (!isNaN(segment)) {
        estimatedDuration += parseInt(segment);
      }
    }
    if (!totalDuration || totalDuration <= 0) {
      totalDuration = estimatedDuration;
    }
    
    if (totalDuration <= 0) {
      // Fallback to requested duration or default
      totalDuration = (duration && duration > 0) ? duration * 60 : 300; // Default 5 minutes
    }
    
    // Final validation to ensure we never have null/undefined duration
    if (!totalDuration || totalDuration <= 0 || isNaN(totalDuration)) {
      console.log(`⚠️ Invalid total duration calculated: ${totalDuration}, using default 300 seconds`);
      totalDuration = 300; // Default 5 minutes in seconds
    }

    const playlistDurationMs = totalDuration * 1000;
    const playlistForDb = storagePlaylist.map(item => ({
      ...item,
      duration: playlistDurationMs
    }));

    // Save meditation to database
    const { data: meditation, error: saveError } = await supabase
      .from('meditations')
      .insert([{
        id: meditationId,
        user_id: userId,
        title: generatedTitle,
        script,
        playlist: playlistForDb,
        note_ids: noteIds,
        duration: totalDuration,
        summary: generatedSummary,
        time_of_reflection: new Date().toISOString(),
        audio_storage_path: audioError ? null : storagePath,
        audio_expires_at: audioError ? null : audioExpiresAt.toISOString(),
        audio_removed_at: null
      }])
      .select()
      .single();

    if (saveError) {
      throw new Error(`Failed to save meditation: ${saveError.message}`);
    }

    try {
      await incrementUsageCounters({ supabase, userId, meditationDelta: 1 });
    } catch (usageError) {
      console.error('[Usage] Failed to increment meditation counters:', usageError);
    }

    // Clean up temp files
    fs.rmSync(tempDir, { recursive: true, force: true });

    // Mark job as completed
    await supabase
      .from('meditation_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        meditation_id: meditation.id
      })
      .eq('id', job.id);

    if (onesignalEnabled()) {
      const notificationTasks = [];
      const pushData = {
        meditationId: meditation.id,
        jobId: job.id,
        url: `/reflections?meditationId=${meditation.id}`,
      };

      let resolvedSubscriptionId = null;
      try {
        const profile = await fetchOneSignalUserByExternalId(userId);
        if (profile && !profile.skipped) {
          const subscriptions = Array.isArray(profile.subscriptions) ? profile.subscriptions : [];
          const primarySubscription = subscriptions.find((sub) => {
            if (!sub || !sub.id) {
              return false;
            }
            if (typeof sub.enabled === 'boolean' && sub.enabled === false) {
              return false;
            }
            if (typeof sub.opted_out === 'boolean' && sub.opted_out === true) {
              return false;
            }
            if (typeof sub.status === 'string') {
              const statusLower = sub.status.toLowerCase();
              if (statusLower === 'inactive' || statusLower === 'revoked' || statusLower === 'unsubscribed') {
                return false;
              }
            }
            return true;
          });
          resolvedSubscriptionId = primarySubscription?.id ?? subscriptions[0]?.id ?? null;
          console.log('[OneSignal] Resolved subscription for notification:', { resolvedSubscriptionId, subscriptionCount: subscriptions.length });
        }
      } catch (error) {
        console.warn('[OneSignal] Failed to fetch user before notification:', error instanceof Error ? error.message : error);
      }

      notificationTasks.push(
        sendOneSignalNotification({
          externalId: userId,
          subscriptionId: resolvedSubscriptionId ?? undefined,
          headings: {
            en: 'Your meditation is ready',
          },
          contents: {
            en: 'Your personalized meditation is waiting for you. It will be available for the next 24 hours.',
          },
          data: pushData,
          url: pushData.url,
        })
      );

      notificationTasks.push(
        sendOneSignalEvent(userId, 'meditation_generated', {
          meditation_id: meditation.id,
          reflection_type: normalizedReflectionType,
          expires_at: audioError ? null : audioExpiresAt.toISOString(),
        })
      );

      const tagUpdates = {
        last_meditation_generated_ts: Math.floor(Date.now() / 1000),
        has_unfinished_meditation: 'true',
      };

      notificationTasks.push(updateOneSignalUser(userId, tagUpdates));

      const notificationResults = await Promise.allSettled(notificationTasks);
      notificationResults.forEach((result) => {
        if (result.status === 'rejected') {
          console.error('OneSignal notification failed for meditation generation:', result.reason);
        }
      });
    }

    console.log(`✅ Background job ${job.id} completed successfully`);

  } catch (error) {
    console.error(`❌ Background job ${job.id} failed:`, error);
    
    // Mark job as failed
    await supabase
      .from('meditation_jobs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: error.message || 'Unknown error occurred'
      })
      .eq('id', job.id);
  }
}

async function processJobQueue() {
  try {
    // Get pending jobs
    const { data: jobs, error } = await supabase
      .from('meditation_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1); // Process one job at a time

    if (error) {
      console.error('Error fetching pending jobs:', error);
      return;
    }

    if (jobs && jobs.length > 0) {
      const job = jobs[0];
      
      // Atomic job claiming - only one worker can claim each job
      const { data: claimedJob, error: claimError } = await supabase
        .from('meditation_jobs')
        .update({
          status: 'processing',
          started_at: new Date().toISOString()
        })
        .eq('id', job.id)
        .eq('status', 'pending') // Only claim if still pending
        .select()
        .single();

      if (claimError || !claimedJob) {
        // Job was already claimed by another worker
        console.log(`📋 Job ${job.id} was already claimed by another worker`);
        return;
      }
      
      console.log(`📋 Claimed job ${claimedJob.id}, starting background processing...`);

      // Process the claimed job; await so status transitions complete before returning
      try {
        await processMeditationJob(claimedJob);
      } catch (error) {
        console.error('Background job processing error:', error);
      }
    }
  } catch (error) {
    console.error('Job queue processing error:', error);
  }
}

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: function(origin, callback) {
    // Allow both http and https localhost for development
    const allowedOrigins = [
      'http://localhost:5173',
      'https://localhost:5173',
      'http://localhost:5174',
      'https://localhost:5174',
      'http://localhost:5175',
      'https://localhost:5175',
      process.env.FRONTEND_URL
    ].filter(Boolean);

    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-OneSignal-Subscription-Id']
}));

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Multer configuration for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow audio files for notes
    if (file.fieldname === 'audio') {
      const allowedMimes = ['audio/wav', 'audio/mpeg', 'audio/mp3'];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid audio file type'), false);
      }
    }
    // Allow image files for photos
    else if (file.fieldname === 'image' || file.fieldname === 'images') {
      const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid image file type'), false);
      }
    }
    // Allow profile images
    else if (file.fieldname === 'profileImage') {
      const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid profile image file type'), false);
      }
    } else {
      cb(new Error('Invalid field name'), false);
    }
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Replay server is running' });
});

// API Routes
app.get('/api', (req, res) => {
  res.json({ message: 'Replay API Server', version: '1.0.0' });
});

// Auth test endpoint
app.get('/api/auth/test', requireAuth(), (req, res) => {
  res.json({ 
    message: 'Authentication successful', 
    user: req.auth.user.email,
    userId: req.auth.userId 
  });
});

// FFmpeg debug endpoint (for troubleshooting Railway deployment)
app.get('/api/debug/ffmpeg', requireAuth(), (req, res) => {
  try {
    const ffmpegPath = getFFmpegPath();
    const envInfo = {
      NODE_ENV: process.env.NODE_ENV,
      RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT,
      RAILWAY_PROJECT_ID: process.env.RAILWAY_PROJECT_ID,
      PATH: process.env.PATH
    };
    
    res.json({
      message: 'FFmpeg path resolution debug info',
      ffmpegPath,
      environment: envInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to resolve ffmpeg path',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

registerNotesRoutes({
  app,
  requireAuth,
  attachEntitlements,
  supabase,
  upload,
  uuidv4,
  gemini
});

registerAccountRoutes({
  app,
  requireAuth,
  supabase
});

registerAuthRoutes({
  app,
  supabase
});

registerProfileRoutes({
  app,
  requireAuth,
  supabase,
  upload,
  uuidv4
});

registerFileRoutes({
  app,
  requireAuth,
  supabase
});

registerStatsRoutes({
  app,
  requireAuth,
  supabase
});

registerProgressRoutes({
  app,
  requireAuth,
  supabase
});

registerMeditationRoutes({
  app,
  requireAuth,
  attachEntitlements,
  supabase,
  uuidv4,
  gemini,
  replicate: replicateClient,
  createSilenceBuffer,
  mergeAudioBuffers,
  resolveVoiceSettings,
  processJobQueue,
  transcodeAudio: transcodeMeditationAudio,
  measureAudioDuration: getWavDurationSeconds,
  ffmpegPathResolver: getFFmpegPath
});

registerSubscriptionRoutes({
  app,
  requireAuth,
  attachEntitlements,
  supabase
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const startSchedulers = (protocol) => {
  console.log(`🚀 Replay server running on ${protocol.toUpperCase()} port ${PORT}`);
  console.log(`📍 Health check: ${protocol}://localhost:${PORT}/health`);
  console.log(`🔗 API base: ${protocol}://localhost:${PORT}/api`);

  console.log('⚙️ Starting background job worker...');

  if (jobWorkerInterval) {
    clearInterval(jobWorkerInterval);
  }

  jobWorkerInterval = setInterval(processJobQueue, 10000);

  processJobQueue().catch(error => {
    console.error('Initial job queue check failed:', error);
  });

  const canSendWeeklyReports = Boolean(process.env.RESEND_API_KEY && process.env.WEEKLY_REPORT_FROM_EMAIL);

  if (weeklyReportInterval) {
    clearInterval(weeklyReportInterval);
  }
  if (weeklyReportReminderInterval) {
    clearInterval(weeklyReportReminderInterval);
  }

  if (canSendWeeklyReports) {
    console.log('📬 Weekly report worker enabled');
    weeklyReportInterval = setInterval(() => {
      weeklyReportWorker.run().catch((error) => {
        console.error('Weekly report worker execution failed:', error);
      });
    }, 60 * 60 * 1000); // hourly

    weeklyReportWorker.run().catch((error) => {
      console.error('Initial weekly report run failed:', error);
    });

    weeklyReportReminderInterval = setInterval(() => {
      weeklyReportReminderWorker.run().catch((error) => {
        console.error('Weekly report reminder worker execution failed:', error);
      });
    }, 10 * 60 * 1000);

    weeklyReportReminderWorker.run().catch((error) => {
      console.error('Initial weekly report reminder run failed:', error);
    });
  } else {
    console.warn('📬 Weekly report worker disabled - missing RESEND_API_KEY or WEEKLY_REPORT_FROM_EMAIL');
  }
};

const maybeCreateHttpsServer = () => {
  const certPath = process.env.DEV_SSL_CERT;
  const keyPath = process.env.DEV_SSL_KEY;

  if (!certPath || !keyPath) {
    return null;
  }

  try {
    const credentials = {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath)
    };

    return https.createServer(credentials, app);
  } catch (error) {
    console.warn('⚠️  Failed to load dev HTTPS certificates. Falling back to HTTP.', error.message);
    return null;
  }
};

const httpsServer = maybeCreateHttpsServer();

if (!process.env.REPLAY_SKIP_SERVER_START) {
  if (httpsServer) {
    httpsServer.listen(PORT, () => startSchedulers('https'));
  } else {
    app.listen(PORT, () => startSchedulers('http'));
  }
}

const shutdownSchedulers = () => {
  if (jobWorkerInterval) {
    clearInterval(jobWorkerInterval);
    jobWorkerInterval = null;
  }

  if (weeklyReportInterval) {
    clearInterval(weeklyReportInterval);
    weeklyReportInterval = null;
  }

  if (weeklyReportReminderInterval) {
    clearInterval(weeklyReportReminderInterval);
    weeklyReportReminderInterval = null;
  }
};

process.on('SIGTERM', shutdownSchedulers);
process.on('SIGINT', shutdownSchedulers);

export { app, processMeditationJob, processJobQueue };
export default app;
