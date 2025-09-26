import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import fs from 'fs';
import http from 'http';
import https from 'https';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleGenAI } from '@google/genai';
import mime from 'mime';
import Replicate from 'replicate';
import { promisify } from 'util';
import { exec, execSync } from 'child_process';
import { concatenateAudioBuffers, generateSilenceBuffer } from './utils/audio.js';

const execAsync = promisify(exec);

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

function resolveVoiceSettings(reflectionType) {
  if (reflectionType === 'Ideas') {
    return { voice: 'af_bella', speed: 0.81 };
  }

  return { voice: 'af_nicole', speed: 0.7 };
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
          } catch (testError) {
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
import { requireAuth, optionalAuth, supabase } from './middleware/auth.js';
import { registerNotesRoutes } from './routes/notes.js';
import { registerMeditationRoutes } from './routes/meditations.js';
import { registerProfileRoutes } from './routes/profile.js';
import { registerFileRoutes } from './routes/files.js';
import { registerStatsRoutes } from './routes/stats.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerAccountRoutes } from './routes/account.js';

// Initialize AI services
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

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
      duration, 
      reflection_type: reflectionType,
      user_id: userId 
    } = job;

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

    // Handle Day meditation with pre-recorded audio
    if (reflectionType === 'Day') {
      const { data: urlData, error: urlError } = await supabase.storage
        .from('meditations')
        .createSignedUrl('default/day-meditation.wav', 3600 * 24);

      if (urlError) {
        throw new Error(`Failed to load day meditation: ${urlError.message}`);
      }

      const defaultPlaylist = [{
        type: 'speech',
        audioUrl: urlData.signedUrl,
        duration: 146000
      }];

      // Save meditation to database
      const { data: savedMeditation, error: saveError } = await supabase
        .from('meditations')
        .insert({
          user_id: userId,
          title: 'Daily Reflection',
          playlist: defaultPlaylist,
          note_ids: noteIds,
          script: 'Pre-recorded daily meditation',
          duration: 146,
          summary: 'Daily reflection meditation',
          time_of_reflection: new Date().toISOString()
        })
        .select()
        .single();

      if (saveError) {
        throw new Error(`Failed to save day meditation: ${saveError.message}`);
      }

      // Mark job as completed
      await supabase
        .from('meditation_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          meditation_id: savedMeditation.id
        })
        .eq('id', job.id);

      console.log(`✅ Day meditation job ${job.id} completed successfully`);
      return;
    }

    // Generate custom meditation for Night/Ideas reflections
    const model = gemini.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
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

    // Create meditation script based on reflection type
    const getScriptPrompt = (type) => {
      if (type === 'Ideas') {
        return `You are an experienced facilitator of knowledge. Create a ${duration}-minute reflection session focused on creativity, innovation, and idea development. Use the format [PAUSE=Xs] for pauses.
        
        ${profileContext}
        
        Experiences:
        ${experiencesText}
        
        Write as plain spoken text only. No markdown formatting.`;
      }
      
      // Default Night meditation
      return `You are an experienced meditation practitioner. Create a ${duration}-minute meditation session with loving-kindness elements. Use the format [PAUSE=Xs] for pauses.
      
      ${profileContext}
      
      Experiences:
      ${experiencesText}
      
      Include metta meditation sending loving-kindness to people and situations from their experiences.
      Write as plain spoken text only. No markdown formatting.`;
    };

    const scriptPrompt = getScriptPrompt(reflectionType);
    const result = await model.generateContent(scriptPrompt);
    const script = result.response.text();

    // Generate TTS and process audio (simplified for background processing)
    const meditationId = uuidv4();
    const segments = script.split(/\[PAUSE=(\d+)s\]/);
    const tempDir = path.join(__dirname, 'temp', meditationId);
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempAudioFiles = [];

    // Process segments for TTS
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i].trim();
      
      if (segment && isNaN(segment)) {
        // Speech segment - generate TTS
        try {
          // Determine voice settings based on reflection type
          const voiceSettings = resolveVoiceSettings(reflectionType);
          
          const output = await replicate.run(
            "jaaari/kokoro-82m:f559560eb822dc509045f3921a1921234918b91739db4bf3daab2169b71c7a13",
            {
              input: {
                text: segment,
                voice: voiceSettings.voice,
                speed: voiceSettings.speed
              }
            }
          );

          const audioUrl = output.url().toString();
          const audioResponse = await fetch(audioUrl);
          const arrayBuffer = await audioResponse.arrayBuffer();
          const audioBuffer = Buffer.from(arrayBuffer);
          
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

    // Concatenate all audio files using buffer approach (no ffmpeg needed)
    const audioBuffers = tempAudioFiles.map(filePath => fs.readFileSync(filePath));
    const finalAudioBuffer = mergeAudioBuffers(audioBuffers);
    const finalAudioFileName = `${meditationId}-complete.wav`;
    
    const { data: audioUpload, error: audioError } = await supabase.storage
      .from('meditations')
      .upload(`${userId}/${finalAudioFileName}`, finalAudioBuffer, {
        contentType: 'audio/wav',
        upsert: false
      });

    let audioUrl = null;
    if (!audioError) {
      const { data: urlData } = await supabase.storage
        .from('meditations')
        .createSignedUrl(`${userId}/${finalAudioFileName}`, 3600 * 24 * 30);
      audioUrl = urlData?.signedUrl || `${userId}/${finalAudioFileName}`;
    }
    
    // Create playlist and calculate duration
    const playlist = [{
      type: 'continuous',
      audioUrl: audioUrl,
      duration: 0
    }];

    let totalDuration = 0;
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i].trim();
      if (segment && isNaN(segment)) {
        totalDuration += Math.ceil(segment.length / 10);
      } else if (!isNaN(segment)) {
        totalDuration += parseInt(segment);
      }
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

    // Save meditation to database
    const { data: meditation, error: saveError } = await supabase
      .from('meditations')
      .insert([{
        id: meditationId,
        user_id: userId,
        title: `${reflectionType} Reflection - ${new Date().toLocaleDateString()}`,
        script,
        playlist,
        note_ids: noteIds,
        duration: totalDuration,
        summary: `Generated ${reflectionType.toLowerCase()} meditation from personal experiences`,
        time_of_reflection: new Date().toISOString()
      }])
      .select()
      .single();

    if (saveError) {
      throw new Error(`Failed to save meditation: ${saveError.message}`);
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
  allowedHeaders: ['Content-Type', 'Authorization']
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
    else if (file.fieldname === 'image') {
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

registerMeditationRoutes({
  app,
  requireAuth,
  supabase,
  uuidv4,
  gemini,
  replicate,
  createSilenceBuffer,
  mergeAudioBuffers,
  resolveVoiceSettings,
  processJobQueue
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

};

process.on('SIGTERM', shutdownSchedulers);
process.on('SIGINT', shutdownSchedulers);

export { app, processMeditationJob, processJobQueue };
export default app;
