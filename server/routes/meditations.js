import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import { calculateStreak } from '../utils/stats.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function registerMeditationRoutes(deps) {
  const { app, requireAuth, supabase, uuidv4, gemini, replicate, notificationService, createSilenceBuffer, mergeAudioBuffers, resolveVoiceSettings, processJobQueue } = deps;

  // ============= REFLECTION & MEDITATION API ROUTES =============

  // POST /api/reflect/suggest - Get suggested experiences for reflection
  app.post('/api/reflect/suggest', requireAuth(), async (req, res) => {
    try {
      const userId = req.auth.userId;
      const { startDate, endDate, limit = 10 } = req.body;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'startDate and endDate are required' });
      }

      // Get user's notes within date range
      const { data: notes, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching notes for reflection:', error);
        return res.status(500).json({ error: 'Failed to fetch experiences' });
      }

      // Use AI to suggest the most meaningful experiences
      try {
        const model = gemini.getGenerativeModel({ model: 'gemini-2.5-flash' });
      
        const notesText = notes.map(note => 
          `${note.date}: ${note.title} - ${note.transcript}`
        ).join('\n\n');

        const suggestPrompt = `
          Based on these personal experiences and reflections, suggest the most meaningful ones for a guided meditation reflection:
        
          ${notesText}
        
          Return a JSON array of note IDs ranked by significance for reflection, with a brief explanation for each:
          {
            "suggestions": [
              {"noteId": "uuid", "reason": "Brief explanation"},
              ...
            ]
          }
        `;

        const result = await model.generateContent(suggestPrompt);
        const aiResponse = result.response.text();
      
        // Try to parse AI response, fallback to all notes if parsing fails
        let suggestions;
        try {
          const parsed = JSON.parse(aiResponse);
          suggestions = parsed.suggestions || [];
        } catch (parseError) {
          suggestions = notes.map(note => ({
            noteId: note.id,
            reason: "Selected for reflection"
          }));
        }

        // Filter notes to match suggestions
        const suggestedNotes = notes.filter(note => 
          suggestions.some(s => s.noteId === note.id)
        );

        res.json({ 
          notes: suggestedNotes,
          suggestions,
          totalAvailable: notes.length
        });

      } catch (aiError) {
        console.error('AI suggestion error:', aiError);
        // Fallback: return all notes without AI suggestions
        res.json({ 
          notes,
          suggestions: notes.map(note => ({
            noteId: note.id,
            reason: "Available for reflection"
          })),
          totalAvailable: notes.length
        });
      }

    } catch (error) {
      console.error('Reflection suggestion error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

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

      // Handle Day meditation - use pre-recorded audio file
      if (reflectionType === 'Day') {
        try {
          // Generate signed URL for the default day meditation file
          const { data: urlData, error: urlError } = await supabase.storage
            .from('meditations')
            .createSignedUrl('default/day-meditation.wav', 3600 * 24); // 24 hours expiry

          if (urlError) {
            console.error('Error generating signed URL for day meditation:', urlError);
            return res.status(500).json({ error: 'Failed to load day meditation' });
          }

          // Create playlist with the real audio file
          const defaultPlaylist = [
            {
              type: 'speech',
              audioUrl: urlData.signedUrl,
              duration: 146000 // 2:26 duration in milliseconds
            }
          ];

          // Save to database
          const { data: savedMeditation, error: saveError } = await supabase
            .from('meditations')
            .insert({
              user_id: userId,
              title: title || 'Daily Reflection',
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
            console.error('Error saving day meditation:', saveError);
            return res.status(500).json({ error: 'Failed to save meditation' });
          }

          console.log('Day meditation created successfully');
          return res.json({
            success: true,
            meditation: savedMeditation,
            playlist: defaultPlaylist
          });

        } catch (error) {
          console.error('Error in day meditation generation:', error);
          return res.status(500).json({ error: 'Failed to generate day meditation' });
        }
      }

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

          if (type === 'Ideas') {
            return `You are an experienced insights synthesizer and facilitator of knowledge. You are great at taking the user's raw experiences and converting them into a ${duration}-minute reflection session. Your role is to provide a focused reflective space for ideas, thoughts and strokes of inspiration. The guided reflection should be thoughtful, with pauses for quiet reflection using the format [PAUSE=Xs], where X is the number of seconds. You are trusted to decide on the duration and number of pauses whenever appropriate. There should be a structure to the session - similar ideas should be grouped and explored first before moving on to ideas which might seem disparate. 
          
            ${profileContext}
          
            Experiences:
            ${experiencesText}

            Create a guided reflection which can revolve around the thems of creativity, innovation, idea development and consolidation/crystallization. You don't have to focus on all of them - focus on whichever is appropriate. This session should:         

            1. Help connect similar and disparate concepts and insights and facilitate idea synthesis whenever possible. You don't have to feel the need to force connections that are not there.

            2. Encourage visualization of certain ideas if there are possible notes or hints of implementation in them.

            3. Connect ideas to values and mission if possible and also link them to the user's what am I thinking about, or other domains or life in general if possible 

            4. Consolidate and crystallize strands of thoughts, ideas, and inspirations in an open-ended, divergent way and not be overly restrictive or too convergent or too presumptive in tone or direction.          

            The tone should be encouraging, nurturing and facilitative.

            Make sure that the opening and closing of the reflection is appropriate and eases them into the session and also at the closing, leaves them energized and ready to go back to their lives with a sense of having digested/internalized the raw thoughts, ideas and inspirations.  

            IMPORTANT: Write the script as plain spoken text only. Do not use any markdown formatting, asterisks. You are only allowed to use the format [PAUSE=Xs] for pauses. Do not include section headers or timestamps like "**Breathing Guidance (1 minute 30 seconds)**". Also, there should not be any pauses after the last segment.`;
          }
        
          // Default prompt for Night meditations
          return `${baseInstructions};

          After incorporating insights from their experiences and connecting to their values and mission, include a metta (loving-kindness) meditation section. Identify specific people, relationships, 
          places, or challenging situations from their selected experiences and guide them through sending loving-kindness to these subjects. Use traditional metta phrases like "May you be happy, may you be healthy, may you be free from suffering, may you find peace and joy" while focusing on the actual people and circumstances from their reflections. Start with sending metta to themselves, then extend
          to loved ones mentioned in their experiences, then to neutral people or challenging relationships from their notes, and finally to any difficult situations or places that came up. This should 
          feel personal and connected to their recent experiences rather than generic metta practice.`;
        };

        const scriptPrompt = getScriptPrompt(reflectionType);

        const result = await model.generateContent(scriptPrompt);
        const script = result.response.text();

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
        
          // Upload the final continuous audio file to Supabase
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
              .createSignedUrl(`${userId}/${finalAudioFileName}`, 3600 * 24 * 30); // 30 days
          
            audioUrl = urlData?.signedUrl || `${userId}/${finalAudioFileName}`;
            console.log(`✅ Complete meditation audio uploaded: ${finalAudioFileName}`);
          } else {
            console.error('❌ Final audio upload error:', audioError);
          }
        
          // Create simplified playlist with single continuous audio
          playlist = [{
            type: 'continuous',
            audioUrl: audioUrl,
            duration: 0 // Will be calculated from actual audio duration
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
        }

        // Save meditation to database
        const { data: meditation, error: saveError } = await supabase
          .from('meditations')
          .insert([{
            id: meditationId,
            user_id: userId,
            title: title || `Meditation - ${new Date().toLocaleDateString()}`,
            script,
            playlist,
            note_ids: noteIds,
            duration: totalDuration,
            summary: `Generated ${reflectionType.toLowerCase()} meditation from personal experiences`,
            time_of_reflection: new Date().toISOString()
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
          playlist: meditation.playlist,
          summary: meditation.summary,
          meditation // Keep for debugging
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

      res.json({ meditations });
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
        if (meditation.playlist && Array.isArray(meditation.playlist)) {
          const audioFiles = meditation.playlist
            .filter(item => item.type === 'speech' && item.url)
            .map(item => {
              // Extract file path from URL
              const urlParts = item.url.split('/');
              return urlParts.slice(-2).join('/'); // Get last two parts (userId/fileName)
            });

          if (audioFiles.length > 0) {
            await supabase.storage.from('meditations').remove(audioFiles);
          }
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

      res.json(meditation);
    } catch (error) {
      console.error('Get meditation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET day reflection default meditation
  app.get('/api/meditations/day/default', requireAuth(), async (req, res) => {
    try {
      // Generate signed URL for the default day meditation file
      const { data: urlData, error: urlError } = await supabase.storage
        .from('meditations')
        .createSignedUrl('default/day-meditation.wav', 3600 * 24); // 24 hours expiry

      if (urlError) {
        console.error('Error generating signed URL for day meditation:', urlError);
        return res.status(500).json({ error: 'Failed to load day meditation' });
      }

      // Create playlist with the real audio file
      const defaultPlaylist = [
        {
          type: 'speech',
          audioUrl: urlData.signedUrl,
          duration: 146000 // 2:26 duration in milliseconds
        }
      ];

      res.json({ 
        playlist: defaultPlaylist,
        title: 'Daily Reflection',
        duration: 146 // Duration in seconds
      });
    } catch (error) {
      console.error('Day reflection error:', error);
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

      if (isCompleted) {
        updateData.completed_at = completedAt || new Date().toISOString();
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

        if (!streakError && completedMeditations) {
          // Get previous streak (before this completion) by filtering out current meditation
          const previousCompletions = completedMeditations.slice(1); // Skip the first one (current meditation)
          previousStreak = calculateStreak(previousCompletions);
          newStreak = calculateStreak(completedMeditations);
          streakUpdated = newStreak !== previousStreak;
        }
      }

      res.json({
        message: isCompleted ? 'Meditation completed successfully' : 'Meditation progress saved',
        streakUpdated,
        newStreak,
        previousStreak,
        completed: isCompleted
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

  // POST /api/replay/radio - Generate radio talk show from experiences
  app.post('/api/replay/radio', requireAuth(), async (req, res) => {
    try {
      const userId = req.auth.userId;
      const { noteIds, duration = 10, title } = req.body;

      if (!noteIds || !Array.isArray(noteIds) || noteIds.length === 0) {
        return res.status(400).json({ error: 'noteIds array is required' });
      }

      const radioId = uuidv4();

      // Get selected notes and user profile
      const { data: notes, error: notesError } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', userId)
        .in('id', noteIds);

      if (notesError) {
        console.error('Error fetching notes for radio show:', notesError);
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
          // Handle different note types for radio content
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
          Host Information - You are hosting a radio show for: ${profile.name || 'the listener'}
          Their personal values: ${profile.values || 'Not specified'}
          Their life mission: ${profile.mission || 'Not specified'}
          What they're currently thinking about/working on: ${profile.thinking_about || 'Not specified'}
        ` : '';

        const radioScriptPrompt = `
          Create a personalized ${duration}-minute radio show revolving around the user's ideas and experiences. Both user information, ideas/experiences will be provided below. There will be two hosts (Speaker 1 and Speaker 2) who will host the show in a casual and light manner. Speaker 1's name will be Jessica, and Speaker 2's name will be Alex. The hosts should interact with each other naturally and have a good chemistry.

          ${profileContext}

          Experiences to cover:
          ${experiencesText}

          CRITICAL FORMATTING REQUIREMENTS:
          - You MUST format the script exactly like this:
          Speaker 1: [Jessica's dialogue here]
          Speaker 2: [Alex's dialogue here] 
          Speaker 1: [Jessica's next dialogue]
          Speaker 2: [Alex's next dialogue]
        
          - Each line must start with exactly "Speaker 1:" or "Speaker 2:" followed by their dialogue
          - Do not use names like "Jessica:" or "Alex:" - only use "Speaker 1:" and "Speaker 2:"
          - Write natural spoken radio content with good back-and-forth conversation
          - No markdown, no section headers, no asterisks
        
          Example format:
          Speaker 1: Good morning everyone and welcome back to The Thought Bubble! I'm Jessica.
          Speaker 2: And I'm Alex! Today we're diving into some fascinating personal reflections.
          Speaker 1: That's right Alex, we have some really interesting experiences to explore today.
        `;

        console.log('🎙️ Generating radio show script...');
        const result = await model.generateContent(radioScriptPrompt);
        const script = result.response.text();

        console.log('📄 Generated script preview:');
        console.log('=' .repeat(80));
        console.log(script.substring(0, 500) + (script.length > 500 ? '...' : ''));
        console.log('=' .repeat(80));

        console.log('🎧 Converting script to audio using Replicate TTS...');

        // Parse script to extract speaker segments
        function parseRadioScript(script) {
          console.log('📝 Parsing radio script for speaker segments...');
          console.log('🔍 Script content to parse:');
          console.log(script.substring(0, 200) + '...');
        
          const segments = [];
          const lines = script.split('\n');
        
          for (let i = 0; i < lines.length; i++) {
            const trimmedLine = lines[i].trim();
            if (!trimmedLine) continue;
          
            console.log(`🔎 Line ${i + 1}: "${trimmedLine}"`);
          
            // Try multiple patterns to match speaker format
            let speakerMatch = null;
            let speaker = null;
            let text = null;
          
            // Pattern 1: "Speaker 1:" or "Speaker 2:"
            speakerMatch = trimmedLine.match(/^(Speaker [12]):\s*(.+)$/);
            if (speakerMatch) {
              speaker = speakerMatch[1];
              text = speakerMatch[2].trim();
            } else {
              // Pattern 2: Names like "Jessica:" or "Alex:"
              const nameMatch = trimmedLine.match(/^(Jessica|Alex):\s*(.+)$/i);
              if (nameMatch) {
                speaker = nameMatch[1].toLowerCase() === 'jessica' ? 'Speaker 1' : 'Speaker 2';
                text = nameMatch[2].trim();
              } else {
                // Pattern 3: Just text without speaker prefix (assign alternating)
                if (trimmedLine.length > 10) { // Only consider substantial text
                  speaker = segments.length % 2 === 0 ? 'Speaker 1' : 'Speaker 2';
                  text = trimmedLine;
                  console.log(`🔄 No speaker prefix found, assigning to ${speaker}`);
                }
              }
            }
          
            if (speaker && text && text.length > 0) {
              segments.push({
                speaker,
                text,
                voice: speaker === 'Speaker 1' ? 'af_jessica' : 'am_puck'
              });
              console.log(`✅ Found ${speaker}: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
            } else {
              console.log(`❌ Line ${i + 1}: No valid speaker segment found`);
            }
          }
        
          console.log(`📊 Parsed ${segments.length} speaker segments`);
          return segments;
        }

        // Generate TTS for individual segments using Replicate (same as meditation TTS)
        async function generateTTSSegment(text, voice, segmentIndex, totalSegments) {
          console.log(`🎙️ [${segmentIndex + 1}/${totalSegments}] Starting Replicate TTS for voice ${voice}`);
          console.log(`📝 Text (${text.length} chars): "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);
        
          const startTime = Date.now();
          console.log(`⏱️ API call started at: ${new Date().toISOString()}`);
        
          try {
            // Use the same Replicate model and approach as the meditation TTS
            const output = await replicate.run(
              "jaaari/kokoro-82m:f559560eb822dc509045f3921a1921234918b91739db4bf3daab2169b71c7a13",
              {
                input: {
                  text: text,
                  voice: voice,
                  speed: 1.0
                }
              }
            );

            // Get the audio URL from the response
            const audioUrl = output.url().toString();
            console.log(`📥 [${segmentIndex + 1}/${totalSegments}] Replicate response: ${audioUrl}`);
          
            // Download the audio file
            const audioResponse = await fetch(audioUrl);
            if (!audioResponse.ok) {
              throw new Error(`Failed to download audio: ${audioResponse.status}`);
            }
          
            const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
          
            const totalTime = Date.now() - startTime;
            console.log(`✅ [${segmentIndex + 1}/${totalSegments}] Replicate TTS completed for ${voice}`);
            console.log(`📊 Buffer size: ${audioBuffer.length} bytes`);
            console.log(`⏱️ Total processing time: ${totalTime}ms`);
            console.log(`🎯 Progress: ${segmentIndex + 1}/${totalSegments} segments completed (${Math.round((segmentIndex + 1) / totalSegments * 100)}%)`);
          
            return audioBuffer;
          
          } catch (error) {
            const totalTime = Date.now() - startTime;
            console.error(`❌ [${segmentIndex + 1}/${totalSegments}] Replicate TTS generation failed after ${totalTime}ms`);
            console.error(`❌ Error details:`, error.message);
            throw error;
          }
        }

        let playlist = [];

        try {
          // Step 1: Parse script into segments
          const segments = parseRadioScript(script);
        
          if (segments.length === 0) {
            throw new Error('No speaker segments found in script');
          }

          // Step 2: Generate TTS for each segment
          console.log('🎙️ Generating TTS for all segments...');
          const audioBuffers = [];
          const silenceBuffer = createSilenceBuffer(0.35);
        
          for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
          
            // Generate TTS for this segment
            const segmentBuffer = await generateTTSSegment(segment.text, segment.voice, i, segments.length);
            audioBuffers.push(segmentBuffer);
          
            // Add pause after each segment except the last one
            if (i < segments.length - 1) {
              audioBuffers.push(silenceBuffer);
              console.log(`🔇 Added 0.35s silence buffer after segment ${i + 1}`);
            }
          }

          // Step 3: Concatenate all audio buffers
          console.log('🔧 Concatenating all audio segments...');
          audioBuffers.forEach((buffer, index) => {
            const isWav = buffer.length > 44 && buffer.toString('ascii', 0, 4) === 'RIFF';
            console.log(`📦 Buffer ${index + 1}: ${buffer.length} bytes ${isWav ? '(WAV)' : '(unknown format)'}`);
          });
          const finalAudioBuffer = mergeAudioBuffers(audioBuffers);

          console.log('🔧 [TTS] Uploading final audio to Supabase...');
          // Upload the concatenated audio file to Supabase
          const fileName = `radio_${radioId}.wav`;
          const filePath = `${userId}/${fileName}`;
          console.log('📁 [TTS] Upload path:', filePath);

          const { error: uploadError } = await supabase.storage
            .from('meditations')
            .upload(filePath, finalAudioBuffer, {
              contentType: 'audio/wav'
            });

          if (uploadError) {
            console.error('❌ [TTS] Error uploading radio audio:', uploadError);
            throw uploadError;
          }
          console.log('✅ [TTS] Audio uploaded successfully to Supabase storage');

          // Generate signed URL for the uploaded file
          const { data: urlData, error: urlError } = await supabase.storage
            .from('meditations')
            .createSignedUrl(filePath, 3600 * 24); // 24 hours expiry

          if (urlError) {
            console.error('❌ [TTS] Error generating signed URL:', urlError);
            throw urlError;
          }
          console.log('✅ [TTS] Signed URL generated:', urlData.signedUrl);

          // Create playlist with the concatenated audio file
          playlist = [
            {
              type: 'speech',
              audioUrl: urlData.signedUrl,
              duration: duration * 60 * 1000 // Convert minutes to milliseconds
            }
          ];
          console.log('✅ [TTS] Playlist created with duration:', duration * 60 * 1000, 'ms');
          console.log('🎉 [TTS] Deep Infra TTS process completed successfully!');

        } catch (ttsError) {
          console.error('❌ [TTS] CRITICAL ERROR in TTS process:', ttsError);
          console.error('❌ [TTS] Error stack:', ttsError.stack);
          throw new Error(`Failed to generate radio show audio: ${ttsError.message}`);
        }

        // Save radio show to database
        const { data: savedRadioShow, error: saveError } = await supabase
          .from('meditations') // Reuse meditations table for radio shows
          .insert({
            id: radioId, // Add the missing radioId
            user_id: userId,
            title: title || 'Radio Show Replay',
            playlist: playlist,
            note_ids: noteIds,
            script: script,
            duration: duration,
            summary: 'Personalized radio talk show replay',
            time_of_reflection: new Date().toISOString()
          })
          .select()
          .single();

        if (saveError) {
          console.error('Error saving radio show:', saveError);
          return res.status(500).json({ error: 'Failed to save radio show' });
        }

        console.log(`🎙️ Radio show generated successfully: ${savedRadioShow.id}`);

        // Send push notification for radio show completion
        try {
          await notificationService.sendPushNotification(userId, {
            type: 'meditation_ready',
            title: 'Your Radio Show is Ready!',
            body: 'Your personalized talk show replay is ready to listen. Tap to tune in now.',
            data: {
              meditationId: savedRadioShow.id,
              type: 'radio',
              url: `/reflections?meditationId=${savedRadioShow.id}`
            }
          });
          console.log(`📱 Push notification sent for completed radio show ${savedRadioShow.id}`);
        } catch (notificationError) {
          console.error(`Failed to send push notification for radio show ${savedRadioShow.id}:`, notificationError);
        }

        res.json({
          radioShow: savedRadioShow,
          playlist: playlist
        });

      } catch (aiError) {
        console.error('AI processing error:', aiError);
        res.status(500).json({ error: 'Failed to generate radio show content' });
      }

    } catch (error) {
      console.error('Radio show generation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}
