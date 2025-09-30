import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import { calculateStreak } from '../utils/stats.js';
import { transcodeAudioBuffer } from '../utils/audio.js';
import {
  onesignalEnabled,
  updateOneSignalUser,
  sendOneSignalEvent,
} from '../utils/onesignal.js';
import {
  incrementMeditationProgress as incrementMeditationProgressDefault,
  loadUserTimezone as loadUserTimezoneDefault,
  buildProgressSummary as buildProgressSummaryDefault
} from '../utils/weeklyProgress.js';
import { DEFAULT_TIMEZONE } from '../utils/week.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function registerMeditationRoutes(deps) {
  const {
    app,
    requireAuth,
    supabase,
    uuidv4,
    gemini,
    replicate,
    createSilenceBuffer,
    mergeAudioBuffers,
    resolveVoiceSettings,
    processJobQueue,
    transcodeAudio: providedTranscodeAudio,
    ffmpegPathResolver,
    weeklyProgressOverrides = {}
  } = deps;

  const AUDIO_AVAILABILITY_WINDOW_MS = 24 * 60 * 60 * 1000;

  const loadUserTimezone = weeklyProgressOverrides.loadUserTimezone ?? loadUserTimezoneDefault;
  const incrementMeditationProgress = weeklyProgressOverrides.incrementMeditationProgress ?? incrementMeditationProgressDefault;
  const buildProgressSummary = weeklyProgressOverrides.buildProgressSummary ?? buildProgressSummaryDefault;

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
      console.error('Failed to parse Gemini JSON response:', error);
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

  const resolveTranscodeAudio = () => {
    if (typeof providedTranscodeAudio === 'function') {
      return providedTranscodeAudio;
    }

    return async (buffer) => {
      try {
        const ffmpegPath = typeof ffmpegPathResolver === 'function' ? ffmpegPathResolver() : 'ffmpeg';
        const compressedBuffer = await transcodeAudioBuffer(buffer, { ffmpegPath, format: 'mp3' });
        return {
          buffer: compressedBuffer,
          contentType: 'audio/mpeg',
          extension: 'mp3'
        };
      } catch (error) {
        console.warn('Audio transcode failed, falling back to WAV:', error.message);
        return {
          buffer,
          contentType: 'audio/wav',
          extension: 'wav'
        };
      }
    };
  };

  const transcodeAudio = resolveTranscodeAudio();

  const computeAudioAvailability = (meditation) => {
    const expiresAtRaw = meditation?.audio_expires_at;
    const removedAtRaw = meditation?.audio_removed_at;
    const storagePath = meditation?.audio_storage_path;

    if (!storagePath || !expiresAtRaw) {
      return { isAvailable: false, secondsRemaining: 0, expiresAt: null };
    }

    const expiresAt = new Date(expiresAtRaw);
    if (Number.isNaN(expiresAt.getTime())) {
      return { isAvailable: false, secondsRemaining: 0, expiresAt: null };
    }

    const removedAt = removedAtRaw ? new Date(removedAtRaw) : null;
    const now = new Date();
    const isExpired = expiresAt <= now || (removedAt && !Number.isNaN(removedAt.getTime()));
    const secondsRemaining = isExpired ? 0 : Math.floor((expiresAt.getTime() - now.getTime()) / 1000);

    return {
      isAvailable: !isExpired,
      secondsRemaining,
      expiresAt,
      storagePath
    };
  };

  const removeMeditationAudio = async (meditationId, userId, storagePath) => {
    if (!storagePath) {
      return;
    }

    try {
      if (!storagePath.startsWith('default/')) {
        await supabase.storage.from('meditations').remove([storagePath]);
      }
    } catch (storageError) {
      console.error('Failed to remove expired meditation audio:', storageError);
    }

    try {
      await supabase
        .from('meditations')
        .update({
          audio_storage_path: null,
          audio_removed_at: new Date().toISOString(),
          playlist: []
        })
        .eq('id', meditationId)
        .eq('user_id', userId);
    } catch (updateError) {
      console.error('Failed to mark meditation audio as removed:', updateError);
    }
  };

  const generateTitleAndSummary = async (script, reflectionType, fallbackTitle) => {
    const prompt = `
      You will receive the full script of a guided meditation session.
      Analyse the content and respond with a concise JSON object using this shape:
      {
        "title": "Short, evocative meditation title",
        "summary": "A short overview, maximum three sentences."
      }

      Requirements:
      - The title must be fewer than 12 words.
      - The summary must not exceed three sentences and should stay under 350 characters.
      - Capture the core themes, tone, and intent of the meditation.
      - Do not include markdown, quotes, or escape sequences.

      Meditation script:
      """
      ${script}
      """
    `;

    try {
      const model = gemini.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent(prompt);
      const rawText = result.response.text();
      const parsed = extractJson(rawText) || {};

      const titleCandidate = typeof parsed.title === 'string' ? parsed.title.trim() : '';
      const summaryCandidate = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';

      const resolvedTitle = titleCandidate || fallbackTitle;
      const resolvedSummary = limitSentences(summaryCandidate, 3) || `Guided ${reflectionType?.toLowerCase?.() || 'meditation'} session based on your recent reflections.`;

      return {
        title: resolvedTitle,
        summary: resolvedSummary
      };
    } catch (error) {
      console.error('Failed to generate meditation title/summary:', error);
      return {
        title: fallbackTitle,
        summary: `Guided ${reflectionType?.toLowerCase?.() || 'meditation'} session based on your recent reflections.`
      };
    }
  };

  // ============= REFLECTION & MEDITATION API ROUTES =============

  // POST /api/reflect/summary - Generate reflection summary
  app.post('/api/reflect/summary', requireAuth(), async (req, res) => {
    try {
      const userId = req.auth.userId;
      const { noteIds, timeOfReflection } = req.body;

      if (!noteIds || !Array.isArray(noteIds) || noteIds.length === 0) {
        return res.status(400).json({ error: 'noteIds array is required' });
      }

      // Get selected notes
      const { data: notes, error: notesError } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', userId)
        .in('id', noteIds)
        .order('date', { ascending: true });

      if (notesError) {
        console.error('Error fetching notes for summary:', notesError);
        return res.status(500).json({ error: 'Failed to fetch selected experiences' });
      }

      // Get user profile for personalized reflection
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, values, mission, thinking_about')
        .eq('user_id', userId)
        .single();

      try {
        const model = gemini.getGenerativeModel({ model: 'gemini-2.5-flash' });
      
        const experiencesText = notes.map(note => {
          // For photo notes, construct combined caption from separate fields for meditation generation
          let noteContent = note.transcript;
          if (note.type === 'photo' && note.original_caption && note.ai_image_description) {
            noteContent = `${note.original_caption} [AI_ANALYSIS: ${note.ai_image_description}]`;
          } else if (note.type === 'photo' && note.original_caption && !note.ai_image_description) {
            noteContent = note.original_caption;
          } else if (note.type === 'photo' && !note.original_caption && note.ai_image_description) {
            noteContent = `[AI_ANALYSIS: ${note.ai_image_description}]`;
          }
          // For audio notes, use transcript as is
          return `${note.date}: ${note.title}\n${noteContent}`;
        }).join('\n\n---\n\n');

        const profileContext = profile ? `
          User's name: ${profile.name || 'User'}
          Personal values: ${profile.values || 'Not specified'}
          Life mission: ${profile.mission || 'Not specified'}
          Currently thinking about/working on: ${profile.thinking_about || 'Not specified'}
        ` : '';

        const summaryPrompt = `
          Create a thoughtful reflection summary for a guided meditation based on these personal experiences:
        
          ${profileContext}
        
          Experiences:
          ${experiencesText}
        
          Time of reflection: ${timeOfReflection || 'Now'}
        
          Generate a warm, personal reflection that:
          1. Identifies key themes and patterns
          2. Highlights growth and insights
          3. Connects experiences to values and mission
          4. Prepares the mind for meditation
        
          Keep it meaningful but concise (2-3 paragraphs).
        `;

        const result = await model.generateContent(summaryPrompt);
        const summary = result.response.text();

        res.json({ 
          summary,
          selectedNotes: notes,
          timeOfReflection: timeOfReflection || new Date().toISOString()
        });

      } catch (aiError) {
        console.error('AI summary error:', aiError);
        res.status(500).json({ error: 'Failed to generate reflection summary' });
      }

    } catch (error) {
      console.error('Reflection summary error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/meditate - Generate meditation from experiences
  app.post('/api/meditate', requireAuth(), async (req, res) => {
    try {
      const userId = req.auth.userId;
      const { noteIds, duration = 10, title, reflectionType } = req.body;

      if (!noteIds || !Array.isArray(noteIds) || noteIds.length === 0) {
        return res.status(400).json({ error: 'noteIds array is required' });
      }

      // Use shared audio helpers for silence generation and concatenation

      const meditationId = uuidv4();

      // Get selected notes and user profile
      const { data: notes, error: notesError } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', userId)
        .in('id', noteIds);

      if (notesError) {
        console.error('Error fetching notes for meditation:', notesError);
        return res.status(500).json({ error: 'Failed to fetch selected experiences' });
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('name, values, mission, thinking_about')
        .eq('user_id', userId)
        .single();

      try {
        const model = gemini.getGenerativeModel({ model: 'gemini-2.5-flash' });
      
        const experiencesText = notes.map(note => {
          // For photo notes, construct combined caption from separate fields for meditation generation
          let noteContent = note.transcript;
          if (note.type === 'photo' && note.original_caption && note.ai_image_description) {
            noteContent = `${note.original_caption} [AI_ANALYSIS: ${note.ai_image_description}]`;
          } else if (note.type === 'photo' && note.original_caption && !note.ai_image_description) {
            noteContent = note.original_caption;
          } else if (note.type === 'photo' && !note.original_caption && note.ai_image_description) {
            noteContent = `[AI_ANALYSIS: ${note.ai_image_description}]`;
          }
          // For audio notes, use transcript as is
          return `${note.date}: ${note.title}\n${noteContent}`;
        }).join('\n\n---\n\n');

        const profileContext = profile ? `
          User's name: ${profile.name || 'User'}
          Personal values: ${profile.values || 'Not specified'}
          Life mission: ${profile.mission || 'Not specified'}
          Currently thinking about/working on: ${profile.thinking_about || 'Not specified'}
        ` : '';

        // Create different prompts based on reflection type
        const getScriptPrompt = (type) => {
          const baseInstructions = `
            You are an experienced meditation practitioner. You are great at taking raw experiences and sensory data and converting them into a ${duration}-minute meditation session. Your role is to provide a focused, reflective space for life's meaningful moments. The guided reflection should be thoughtful and not cloying, with pauses for quiet reflection using the format [PAUSE=Xs], where X is the number of seconds. You are trusted to decide on the duration and number of pauses.
          
            ${profileContext}
          
            Experiences:
            ${experiencesText}
          
            Make sure that the opening and closing of the meditation is appropriate and eases them into the meditation and also at the closing, prepares them for rest and recharge.
          
            IMPORTANT: Write the script as plain spoken text only. Do not use any markdown formatting, asterisks. You are only allowed to use the format [PAUSE=Xs] for pauses. Do not include section headers or timestamps like "**Breathing Guidance (1 minute 30 seconds)**". Also, there should not be any pauses after the last segment.
          `;

          if (type === 'Day') {
            return `${baseInstructions}

            Guide the listener through a mindful morning practice that helps them feel grounded, grateful, and energized for the day ahead. Encourage gentle breath awareness, highlight meaningful themes from their recent experiences, and weave in intention-setting prompts that connect back to their personal values and mission. Include moments that foster optimism, clarity, and purposeful action for the hours ahead.`;
          }

          return `${baseInstructions}

          After incorporating insights from their experiences and connecting to their values and mission, include a loving-kindness (metta) meditation section. Identify specific people, relationships, places, or challenging situations from their notes and guide them through sending loving-kindness using phrases like "May you be happy, may you be healthy, may you be free from suffering, may you find peace and joy." Start with the listener, extend to loved ones, then to neutral or challenging relationships, and close with any difficult circumstances that surfaced. Keep it personal and grounded in their reflections.`;
        };

        const scriptPrompt = getScriptPrompt(reflectionType);

        const result = await model.generateContent(scriptPrompt);
        const script = result.response.text();

        const fallbackTitle = title || `Meditation - ${new Date().toLocaleDateString()}`;
        const { title: generatedTitle, summary: generatedSummary } = await generateTitleAndSummary(
          script,
          reflectionType,
          fallbackTitle
        );

        // Save meditation script to file for logging
        try {
          const logsDir = join(__dirname, 'logs', 'meditation-scripts');
          if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
          }

          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const logFileName = `${timestamp}_${userId.substring(0, 8)}_${duration}min.txt`;
          const logFilePath = join(logsDir, logFileName);

          // Parse segments for logging
          const segments = script.split(/\[PAUSE=(\d+)s\]/);
          const segmentAnalysis = segments.map((seg, i) => {
            if (seg.trim() && isNaN(seg)) {
              return `Speech Segment ${Math.floor(i/2)}: "${seg.trim().slice(0, 100)}${seg.trim().length > 100 ? '...' : ''}"`;
            } else if (!isNaN(seg) && seg.trim()) {
              return `Pause Segment: ${seg} seconds`;
            }
            return null;
          }).filter(Boolean);

          const logContent = `MEDITATION SCRIPT LOG
  ====================
  Generated: ${new Date().toISOString()}
  User ID: ${userId}
  Duration: ${duration} minutes
  Profile: ${profile?.name || 'Unknown'}
  Selected Experiences: ${noteIds?.length || 0}

  FULL GENERATED SCRIPT:
  ----------------------
  ${script}

  PARSED SEGMENTS:
  ---------------
  ${segmentAnalysis.join('\n')}

  Total Segments: ${segmentAnalysis.length}
  Script Length: ${script.length} characters
  `;

          fs.writeFileSync(logFilePath, logContent, 'utf8');
          console.log(`📝 Meditation script saved to: ${logFilePath}`);
        } catch (logError) {
          console.error('Failed to save meditation script log:', logError);
        }

        // Generate TTS for meditation segments and create continuous audio file
        const segments = script.split(/\[PAUSE=(\d+)s\]/);
        const tempAudioFiles = [];
        const tempDir = join(__dirname, 'temp', meditationId);
      
        // Create temp directory for processing
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        // Declare playlist variable in proper scope
        let playlist = null;
        let storagePlaylist = null;
        let signedPlaybackPlaylist = null;
        let audioStoragePath = null;
        let audioExpiresAt = new Date(Date.now() + AUDIO_AVAILABILITY_WINDOW_MS);

        try {
          // Process all segments and create individual audio files
          for (let i = 0; i < segments.length; i++) {
            const segment = segments[i].trim();
          
            if (segment && isNaN(segment)) {
              // This is a speech segment, generate TTS
              try {
                console.log(`🔊 Generating TTS for segment ${i}: "${segment.substring(0, 100)}${segment.length > 100 ? '...' : ''}"`);
              
                // Determine voice settings based on reflection type
                const voiceSettings = resolveVoiceSettings(reflectionType);
              
                const replicateInput = {
                  text: segment,
                  voice: voiceSettings.voice,
                  speed: voiceSettings.speed
                };
              
                console.log('📤 Replicate API call:', {
                  model: "jaaari/kokoro-82m:f559560eb822dc509045f3921a1921234918b91739db4bf3daab2169b71c7a13",
                  input: replicateInput
                });
              
                const output = await replicate.run(
                  "jaaari/kokoro-82m:f559560eb822dc509045f3921a1921234918b91739db4bf3daab2169b71c7a13",
                  { input: replicateInput }
                );

                // Get the audio URL from the response
                const audioUrl = output.url().toString();
                console.log('📥 Replicate API response:', { audioUrl });
              
                // Download TTS audio to temp file
                const audioResponse = await fetch(audioUrl);
                const arrayBuffer = await audioResponse.arrayBuffer();
                const audioBuffer = Buffer.from(arrayBuffer);
              
          const tempFileName = join(tempDir, `segment-${i}-speech.wav`);
                fs.writeFileSync(tempFileName, audioBuffer);
                tempAudioFiles.push(tempFileName);
              
                console.log(`✅ TTS segment saved: ${tempFileName}`);

              } catch (ttsError) {
                console.error('❌ TTS generation failed for segment:', ttsError);
                console.error('Segment text:', segment.substring(0, 200));
                // Create a very short silence file as fallback - using buffer approach
                const silenceBuffer = createSilenceBuffer(0.1);
          const tempFileName = join(tempDir, `segment-${i}-speech.wav`);
                fs.writeFileSync(tempFileName, silenceBuffer);
                tempAudioFiles.push(tempFileName);
              }
            } else if (!isNaN(segment)) {
              // This is a pause duration, create silent audio - using buffer approach
              let pauseDuration = parseInt(segment);
              if (isNaN(pauseDuration) || pauseDuration <= 0) {
                console.log(`⚠️ Invalid pause duration: ${segment}, using 3 seconds default`);
                pauseDuration = 3;
              }
              console.log(`⏸️ Creating silence: ${pauseDuration} seconds`);
            
              const silenceBuffer = createSilenceBuffer(pauseDuration);
        const tempFileName = join(tempDir, `segment-${i}-pause.wav`);
              fs.writeFileSync(tempFileName, silenceBuffer);
              tempAudioFiles.push(tempFileName);
            
              console.log(`✅ Silence segment created: ${tempFileName}`);
            }
          }

          // Concatenate all audio files using buffer approach (no ffmpeg needed)
          console.log('🎵 Concatenating audio segments...');
          const audioBuffers = tempAudioFiles.map(filePath => fs.readFileSync(filePath));
          const finalAudioBuffer = mergeAudioBuffers(audioBuffers);
          console.log('✅ Audio concatenation complete');

          let audioResult;
          try {
            audioResult = await transcodeAudio(finalAudioBuffer, { reflectionType, duration });
          } catch (transcodeError) {
            console.warn('Audio transcode threw unexpectedly, using WAV fallback:', transcodeError.message);
            audioResult = {
              buffer: finalAudioBuffer,
              contentType: 'audio/wav',
              extension: 'wav'
            };
          }

          const finalAudioFileName = `${meditationId}-complete.${audioResult.extension}`;
          const finalAudioStoragePath = `${userId}/${finalAudioFileName}`;

          const { error: audioError } = await supabase.storage
            .from('meditations')
            .upload(finalAudioStoragePath, audioResult.buffer, {
              contentType: audioResult.contentType,
              upsert: false
            });

          let signedAudioUrl = null;
          if (!audioError) {
            const { data: urlData } = await supabase.storage
              .from('meditations')
              .createSignedUrl(finalAudioStoragePath, 3600 * 24);

            signedAudioUrl = urlData?.signedUrl || null;
            audioStoragePath = finalAudioStoragePath;
            console.log(`✅ Complete meditation audio uploaded: ${finalAudioFileName}`);
          } else {
            console.error('❌ Final audio upload error:', audioError);
          }

          // Create simplified playlist with single continuous audio
          playlist = [{
            type: 'continuous',
            audioUrl: signedAudioUrl,
            duration: 0 // Will be calculated from actual audio duration
          }];

          storagePlaylist = [{
            type: 'continuous',
            audioUrl: finalAudioStoragePath,
            duration: 0
          }];

          signedPlaybackPlaylist = [{
            type: 'continuous',
            audioUrl: signedAudioUrl,
            duration: 0
          }];

          // Clean up temp files
          try {
            fs.rmSync(tempDir, { recursive: true, force: true });
            console.log('🗑️ Temp files cleaned up');
          } catch (cleanupError) {
            console.error('⚠️ Temp file cleanup failed:', cleanupError);
          }

        } catch (processingError) {
          console.error('❌ Audio processing failed:', processingError);
          // Create fallback playlist for error cases
          playlist = [{
            type: 'continuous',
            audioUrl: null,
            duration: 0
          }];
          storagePlaylist = [{
            type: 'continuous',
            audioUrl: null,
            duration: 0
          }];
          signedPlaybackPlaylist = [{
            type: 'continuous',
            audioUrl: null,
            duration: 0
          }];
          // Clean up temp files on error
          try {
            fs.rmSync(tempDir, { recursive: true, force: true });
          } catch (cleanupError) {
            console.error('⚠️ Temp file cleanup failed:', cleanupError);
          }
          // Don't throw error - allow meditation to be saved with empty playlist
          console.log('⚠️ Continuing with fallback playlist due to audio processing error');
        }

        // Calculate total duration from the original segments for database storage
        let totalDuration = 0;
        const originalSegments = script.split(/\[PAUSE=(\d+)s\]/);
      
        for (let i = 0; i < originalSegments.length; i++) {
          const segment = originalSegments[i].trim();
          if (segment && isNaN(segment)) {
            // Speech segment - estimate 10 characters per second
            totalDuration += Math.ceil(segment.length / 10);
          } else if (!isNaN(segment)) {
            // Pause segment
            totalDuration += parseInt(segment);
          }
        }

        // Ensure we have a minimum valid duration (fallback to requested duration in seconds)
        if (totalDuration <= 0 && duration) {
          totalDuration = duration * 60; // Convert minutes to seconds
        }

        // Final fallback if everything fails
        if (totalDuration <= 0) {
          totalDuration = 300; // Default 5 minutes in seconds
        }
      
        console.log('🎵 Meditation generation complete:');
        console.log(`- Continuous audio file created`);
        console.log(`- Original segments processed: ${originalSegments.length}`);
        console.log(`- Estimated total duration: ${totalDuration} seconds`);

        // Ensure playlist is defined before database insertion
        if (!playlist) {
          console.warn('⚠️ Playlist is null, creating fallback');
          playlist = [{
            type: 'continuous',
            audioUrl: null,
            duration: 0
          }];
          storagePlaylist = [{
            type: 'continuous',
            audioUrl: null,
            duration: 0
          }];
          signedPlaybackPlaylist = [{
            type: 'continuous',
            audioUrl: null,
            duration: 0
          }];
        }

        const playlistDurationMs = totalDuration * 1000;
        storagePlaylist = (storagePlaylist || []).map(item => ({
          ...item,
          duration: playlistDurationMs
        }));
        signedPlaybackPlaylist = (signedPlaybackPlaylist || []).map(item => ({
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
            playlist: storagePlaylist,
            note_ids: noteIds,
            duration: totalDuration,
            summary: generatedSummary,
            time_of_reflection: new Date().toISOString(),
            audio_storage_path: audioStoragePath,
            audio_expires_at: audioStoragePath ? audioExpiresAt.toISOString() : null,
            audio_removed_at: null
          }])
          .select()
          .single();

        // Validate required fields before database insert
        if (!totalDuration || totalDuration <= 0) {
          console.error('❌ Invalid duration calculated:', totalDuration);
          return res.status(500).json({ error: 'Failed to calculate meditation duration' });
        }

        if (saveError) {
          console.error('Error saving meditation:', saveError);
          return res.status(500).json({ error: 'Failed to save meditation' });
        }

        res.status(201).json({ 
          playlist: signedPlaybackPlaylist,
          summary: generatedSummary,
          title: generatedTitle,
          expiresAt: audioStoragePath ? audioExpiresAt.toISOString() : null,
          meditation
        });

      } catch (aiError) {
        console.error('Meditation generation error:', aiError);
        res.status(500).json({ error: 'Failed to generate meditation script' });
      }

    } catch (error) {
      console.error('Meditation creation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/meditations - Get user's saved meditations
  app.get('/api/meditations', requireAuth(), async (req, res) => {
    try {
      const userId = req.auth.userId;
      const { limit = 20, offset = 0 } = req.query;

      const { data: meditations, error } = await supabase
        .from('meditations')
        .select('*, is_viewed')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error fetching meditations:', error);
        return res.status(500).json({ error: 'Failed to fetch meditations' });
      }

      const enrichedMeditations = (meditations || []).map(meditation => {
        const availability = computeAudioAvailability(meditation);

        return {
          ...meditation,
          playlist: availability.isAvailable ? meditation.playlist : [],
          is_audio_available: availability.isAvailable,
          audio_seconds_remaining: availability.isAvailable ? availability.secondsRemaining : 0
        };
      });

      res.json({ meditations: enrichedMeditations });
    } catch (error) {
      console.error('Meditations fetch error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // DELETE /api/meditations/:id - Delete user's meditation
  app.delete('/api/meditations/:id', requireAuth(), async (req, res) => {
    try {
      const userId = req.auth.userId;
      const meditationId = req.params.id;

      // First get the meditation to check ownership and get audio URLs
      const { data: meditation, error: fetchError } = await supabase
        .from('meditations')
        .select('*')
        .eq('id', meditationId)
        .eq('user_id', userId)
        .single();

      if (fetchError || !meditation) {
        return res.status(404).json({ error: 'Meditation not found' });
      }

      // Delete associated audio files from storage
      try {
        if (meditation.audio_storage_path && !meditation.audio_storage_path.startsWith('default/')) {
          await supabase.storage.from('meditations').remove([meditation.audio_storage_path]);
        }
      } catch (storageError) {
        console.error('Storage deletion error:', storageError);
        // Continue with meditation deletion even if file deletion fails
      }

      // Delete the meditation record
      const { error: deleteError } = await supabase
        .from('meditations')
        .delete()
        .eq('id', meditationId)
        .eq('user_id', userId);

      if (deleteError) {
        console.error('Error deleting meditation:', deleteError);
        return res.status(500).json({ error: 'Failed to delete meditation' });
      }

      res.json({ message: 'Meditation deleted successfully' });
    } catch (error) {
      console.error('Meditation deletion error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // PUT /api/meditations/:id/mark-viewed - Mark meditation as viewed when clicked
  app.put('/api/meditations/:id/mark-viewed', requireAuth(), async (req, res) => {
    try {
      const userId = req.auth.userId;
      const meditationId = req.params.id;

      // Update the is_viewed field
      const { data, error } = await supabase
        .from('meditations')
        .update({ is_viewed: true })
        .eq('id', meditationId)
        .eq('user_id', userId)
        .select('id');

      if (error) {
        console.error('Error marking meditation as viewed:', error);
        return res.status(500).json({ error: 'Failed to mark meditation as viewed' });
      }

      if (!data || data.length === 0) {
        return res.status(404).json({ error: 'Meditation not found' });
      }

      res.json({ message: 'Meditation marked as viewed successfully' });
    } catch (error) {
      console.error('Mark viewed error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET specific meditation by ID
  app.get('/api/meditations/:id', requireAuth(), async (req, res) => {
    try {
      const userId = req.auth.userId;
      const meditationId = req.params.id;

      const { data: meditation, error } = await supabase
        .from('meditations')
        .select('*')
        .eq('id', meditationId)
        .eq('user_id', userId)
        .single();

      if (error || !meditation) {
        return res.status(404).json({ error: 'Meditation not found' });
      }

      const availability = computeAudioAvailability(meditation);

      if (!availability.isAvailable) {
        if (availability.storagePath && !meditation.audio_removed_at) {
          await removeMeditationAudio(meditationId, userId, availability.storagePath);
        }
        return res.status(410).json({ error: 'Meditation audio is no longer available', isExpired: true });
      }

      const ttlSeconds = Math.max(1, Math.min(availability.secondsRemaining, 3600));

      const { data: urlData, error: urlError } = await supabase.storage
        .from('meditations')
        .createSignedUrl(availability.storagePath, ttlSeconds);

      if (urlError || !urlData?.signedUrl) {
        console.error('Error generating signed URL for meditation playback:', urlError);
        return res.status(500).json({ error: 'Failed to generate playback URL' });
      }

      const storedPlaylist = Array.isArray(meditation.playlist) ? meditation.playlist : [];
      const playbackPlaylist = storedPlaylist.map(item => {
        if ((item.audioUrl && typeof item.audioUrl === 'string') || !('audioUrl' in item)) {
          return {
            ...item,
            audioUrl: urlData.signedUrl
          };
        }
        return item;
      });

      res.json({
        ...meditation,
        playlist: playbackPlaylist,
        is_audio_available: true,
        audio_seconds_remaining: availability.secondsRemaining,
        audio_expires_at: meditation.audio_expires_at
      });
    } catch (error) {
      console.error('Get meditation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/meditations/:id/complete - Mark meditation as completed
  app.post('/api/meditations/:id/complete', requireAuth(), async (req, res) => {
    try {
      const userId = req.auth.userId;
      const meditationId = req.params.id;
      const { completionPercentage, completedAt } = req.body;

      // Validate input
      if (typeof completionPercentage !== 'number' || completionPercentage < 0 || completionPercentage > 100) {
        return res.status(400).json({ error: 'Invalid completion percentage' });
      }

      // First verify the meditation exists and belongs to the user
      const { data: meditation, error: fetchError } = await supabase
        .from('meditations')
        .select('id, completed_at')
        .eq('id', meditationId)
        .eq('user_id', userId)
        .single();

      if (fetchError || !meditation) {
        return res.status(404).json({ error: 'Meditation not found' });
      }

      // Prevent duplicate completions
      if (meditation.completed_at) {
        return res.json({ 
          message: 'Meditation already completed',
          streakUpdated: false,
          alreadyCompleted: true
        });
      }

      // Only count as completed if >= 95% was listened to
      const isCompleted = completionPercentage >= 95;
    
      // Update the meditation with completion data
      const updateData = {
        completion_percentage: completionPercentage
      };

      let completionTimestamp = null;

      if (isCompleted) {
        completionTimestamp = completedAt || new Date().toISOString();
        updateData.completed_at = completionTimestamp;
      }

      const { error: updateError } = await supabase
        .from('meditations')
        .update(updateData)
        .eq('id', meditationId)
        .eq('user_id', userId);

      if (updateError) {
        console.error('Error updating meditation completion:', updateError);
        return res.status(500).json({ error: 'Failed to update meditation completion' });
      }

      // Calculate new streak if meditation was completed
      let newStreak = 0;
      let previousStreak = 0;
      let streakUpdated = false;

      if (isCompleted) {
        // Get current streak before this completion
        const { data: completedMeditations, error: streakError } = await supabase
          .from('meditations')
          .select('completed_at')
          .eq('user_id', userId)
          .not('completed_at', 'is', null)
          .order('completed_at', { ascending: false });

        let completionsCount = 0;

        if (!streakError && completedMeditations) {
          // Get previous streak (before this completion) by filtering out current meditation
          const previousCompletions = completedMeditations.slice(1); // Skip the first one (current meditation)
          previousStreak = calculateStreak(previousCompletions);
          newStreak = calculateStreak(completedMeditations);
          streakUpdated = newStreak !== previousStreak;
          completionsCount = completedMeditations.length;
        }

        if (onesignalEnabled()) {
          completionTimestamp = completionTimestamp || new Date().toISOString();
          const tags = {
            last_meditation_completed_ts: Math.floor(new Date(completionTimestamp).getTime() / 1000),
            meditation_streak: Math.max(newStreak || 0, 0),
          };

          if (completionsCount <= 1 && completionsCount >= 0) {
            tags.first_meditation_completed = 'true';
          }

          const onesignalTasks = [
            updateOneSignalUser(userId, tags),
            sendOneSignalEvent(userId, 'meditation_completed', {
              meditation_id: meditationId,
              completion_percentage: completionPercentage,
              streak: newStreak,
              completed_at: completionTimestamp,
            }),
          ];

          const completionResults = await Promise.allSettled(onesignalTasks);
          completionResults.forEach((result) => {
            if (result.status === 'rejected') {
              console.error('Failed to sync OneSignal after meditation completion:', result.reason);
            }
          });
        }
      }

      let weeklyProgress = null;

      if (isCompleted) {
        try {
          const timezone = await loadUserTimezone({ supabase, userId }) ?? DEFAULT_TIMEZONE;
          const progressRow = await incrementMeditationProgress({
            supabase,
            userId,
            referenceDate: completionTimestamp,
            eventTimestamp: completionTimestamp,
            timezone
          });
          weeklyProgress = buildProgressSummary(progressRow, timezone);
        } catch (progressError) {
          console.error('Weekly progress update failed after meditation completion:', progressError);
        }
      }

      res.json({
        message: isCompleted ? 'Meditation completed successfully' : 'Meditation progress saved',
        streakUpdated,
        newStreak,
        previousStreak,
        completed: isCompleted,
        weeklyProgress
      });

    } catch (error) {
      console.error('Meditation completion error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ============= BACKGROUND MEDITATION JOB API ROUTES =============

  // Rate limiting for background job creation
  const jobCreationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each user to 5 job requests per windowMs
    message: { error: 'Too many meditation requests. Please wait before creating more background jobs.' },
    standardHeaders: true,
    legacyHeaders: false,
    // Use user ID for rate limiting - skip IP-based limiting to avoid IPv6 issues
    keyGenerator: (req) => req.auth?.userId || 'anonymous',
    skip: (req) => !req.auth?.userId // Skip rate limiting if no user ID
  });

  // POST /api/meditate/jobs - Create background meditation job
  app.post('/api/meditate/jobs', jobCreationLimiter, requireAuth(), async (req, res) => {
    try {
      const userId = req.auth.userId;
      const { noteIds, duration, reflectionType, startDate, endDate } = req.body;

      if (!noteIds || !Array.isArray(noteIds) || noteIds.length === 0) {
        return res.status(400).json({ error: 'noteIds array is required' });
      }

      if (!duration || !reflectionType) {
        return res.status(400).json({ error: 'duration and reflectionType are required' });
      }

      // Create job record
      const { data: job, error: jobError } = await supabase
        .from('meditation_jobs')
        .insert([{
          user_id: userId,
          status: 'pending',
          job_type: reflectionType.toLowerCase(),
          note_ids: noteIds,
          duration: parseInt(duration),
          reflection_type: reflectionType,
          start_date: startDate || null,
          end_date: endDate || null
        }])
        .select()
        .single();

      if (jobError) {
        console.error('Error creating meditation job:', jobError);
        return res.status(500).json({ error: 'Failed to create background job' });
      }

      // Trigger immediate job processing check
      console.log(`📋 Created meditation job ${job.id} for user ${userId}`);
    
      // Trigger job processing without waiting
      setTimeout(() => {
        processJobQueue().catch(error => {
          console.error('Job processing trigger failed:', error);
        });
      }, 1000); // 1 second delay to ensure job is committed

      res.status(201).json({
        jobId: job.id,
        status: job.status,
        estimatedDuration: 120, // 2 minutes estimate
        message: 'Generation started. You can close this modal and continue using the app.'
      });

    } catch (error) {
      console.error('Job creation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/meditate/jobs/:id - Check job status
  app.get('/api/meditate/jobs/:id', requireAuth(), async (req, res) => {
    try {
      const userId = req.auth.userId;
      const jobId = req.params.id;

      const { data: job, error } = await supabase
        .from('meditation_jobs')
        .select('*')
        .eq('id', jobId)
        .eq('user_id', userId)
        .single();

      if (error || !job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      // Build response based on job status
      const response = {
        jobId: job.id,
        status: job.status,
        reflectionType: job.reflection_type,
        duration: job.duration,
        experienceCount: job.note_ids ? job.note_ids.length : 0,
        createdAt: job.created_at
      };

      if (job.status === 'processing') {
        response.startedAt = job.started_at;
        response.progress = 50; // Basic progress indicator
      }

      if (job.status === 'completed') {
        response.completedAt = job.completed_at;
        response.meditationId = job.meditation_id;
      
        // Get meditation details if completed
        if (job.meditation_id) {
          const { data: meditation } = await supabase
            .from('meditations')
            .select('title, summary, playlist')
            .eq('id', job.meditation_id)
            .single();

          if (meditation) {
            response.result = {
              title: meditation.title,
              summary: meditation.summary,
              playlist: meditation.playlist
            };
          }
        }
      }

      if (job.status === 'failed') {
        response.error = job.error_message || 'Unknown error occurred';
        response.canRetry = job.retry_count < 3;
        response.failedAt = job.completed_at;
      }

      res.json(response);

    } catch (error) {
      console.error('Job status check error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/meditate/jobs - List user's jobs
  app.get('/api/meditate/jobs', requireAuth(), async (req, res) => {
    try {
      const userId = req.auth.userId;
      const { status, limit = 20 } = req.query;

      let query = supabase
        .from('meditation_jobs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (status) {
        const statusList = status.split(',');
        query = query.in('status', statusList);
      }

      const { data: jobs, error } = await query.limit(parseInt(limit));

      if (error) {
        console.error('Error fetching meditation jobs:', error);
        return res.status(500).json({ error: 'Failed to fetch jobs' });
      }

      const transformedJobs = jobs.map(job => ({
        jobId: job.id,
        status: job.status,
        reflectionType: job.reflection_type,
        duration: job.duration,
        experienceCount: job.note_ids ? job.note_ids.length : 0,
        createdAt: job.created_at,
        completedAt: job.completed_at,
        meditationId: job.meditation_id,
        error: job.error_message
      }));

      res.json({ jobs: transformedJobs });

    } catch (error) {
      console.error('Jobs fetch error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/meditate/jobs/:id/retry - Retry failed job
  app.post('/api/meditate/jobs/:id/retry', requireAuth(), async (req, res) => {
    try {
      const userId = req.auth.userId;
      const jobId = req.params.id;

      // Get the failed job
      const { data: job, error: fetchError } = await supabase
        .from('meditation_jobs')
        .select('*')
        .eq('id', jobId)
        .eq('user_id', userId)
        .single();

      if (fetchError || !job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      if (job.status !== 'failed') {
        return res.status(400).json({ error: 'Only failed jobs can be retried' });
      }

      if (job.retry_count >= 3) {
        return res.status(400).json({ error: 'Maximum retry attempts exceeded' });
      }

      // Reset job for retry
      const { data: updatedJob, error: updateError } = await supabase
        .from('meditation_jobs')
        .update({
          status: 'pending',
          error_message: null,
          retry_count: job.retry_count + 1,
          started_at: null,
          completed_at: null
        })
        .eq('id', jobId)
        .eq('user_id', userId)
        .select()
        .single();

      if (updateError) {
        console.error('Error retrying job:', updateError);
        return res.status(500).json({ error: 'Failed to retry job' });
      }

      console.log(`🔄 Retrying meditation job ${jobId} (attempt ${updatedJob.retry_count})`);

      res.json({
        jobId: updatedJob.id,
        status: updatedJob.status,
        retryCount: updatedJob.retry_count,
        message: 'Job queued for retry'
      });

    } catch (error) {
      console.error('Job retry error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // DELETE /api/meditate/jobs/:id - Cancel/delete job
  app.delete('/api/meditate/jobs/:id', requireAuth(), async (req, res) => {
    try {
      const userId = req.auth.userId;
      const jobId = req.params.id;

      // Get the job first
      const { data: job, error: fetchError } = await supabase
        .from('meditation_jobs')
        .select('*')
        .eq('id', jobId)
        .eq('user_id', userId)
        .single();

      if (fetchError || !job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      // Can't cancel processing jobs (would need worker coordination)
      if (job.status === 'processing') {
        return res.status(400).json({ error: 'Cannot cancel job that is currently processing' });
      }

      // Delete the job
      const { error: deleteError } = await supabase
        .from('meditation_jobs')
        .delete()
        .eq('id', jobId)
        .eq('user_id', userId);

      if (deleteError) {
        console.error('Error deleting job:', deleteError);
        return res.status(500).json({ error: 'Failed to delete job' });
      }

      console.log(`🗑️ Deleted meditation job ${jobId}`);
      res.json({ message: 'Job deleted successfully' });

    } catch (error) {
      console.error('Job deletion error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

}
