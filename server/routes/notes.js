import {
  buildProgressSummary as buildProgressSummaryDefault,
  incrementJournalProgress as incrementJournalProgressDefault,
  decrementJournalProgress as decrementJournalProgressDefault,
  loadUserTimezone as loadUserTimezoneDefault
} from '../utils/weeklyProgress.js';
import {
  onesignalEnabled as onesignalEnabledDefault,
  updateOneSignalUser as updateOneSignalUserDefault,
  sendOneSignalEvent as sendOneSignalEventDefault,
  attachExternalIdToSubscription as attachExternalIdToSubscriptionDefault
} from '../utils/onesignal.js';

export function registerNotesRoutes(deps) {
  const { app, requireAuth, supabase, upload, uuidv4, gemini } = deps;
  const { weeklyProgressOverrides = {} } = deps;
  const onesignalOverrides = deps.onesignalOverrides ?? {};

  const loadUserTimezone = weeklyProgressOverrides.loadUserTimezone ?? loadUserTimezoneDefault;
  const incrementJournalProgress = weeklyProgressOverrides.incrementJournalProgress ?? incrementJournalProgressDefault;
  const decrementJournalProgress = weeklyProgressOverrides.decrementJournalProgress ?? decrementJournalProgressDefault;
  const buildProgressSummary = weeklyProgressOverrides.buildProgressSummary ?? buildProgressSummaryDefault;
  const onesignalEnabled = onesignalOverrides.onesignalEnabled ?? onesignalEnabledDefault;
  const updateOneSignalUser = onesignalOverrides.updateOneSignalUser ?? updateOneSignalUserDefault;
  const sendOneSignalEvent = onesignalOverrides.sendOneSignalEvent ?? sendOneSignalEventDefault;
  const attachExternalIdToSubscription = onesignalOverrides.attachExternalIdToSubscription ?? attachExternalIdToSubscriptionDefault;

  const getOneSignalSubscriptionId = (req) => {
    const header = req.headers['x-onesignal-subscription-id'];
    if (!header) {
      return null;
    }
    if (Array.isArray(header)) {
      return header[0]?.trim() || null;
    }
    if (typeof header === 'string') {
      return header.trim() || null;
    }
    return null;
  };

  const syncOneSignalAlias = async (req, userId) => {
    console.log('[OneSignal] syncOneSignalAlias called for userId:', userId);

    if (!onesignalEnabled()) {
      console.log('[OneSignal] Disabled, skipping alias sync');
      return;
    }

    const subscriptionId = getOneSignalSubscriptionId(req);
    console.log('[OneSignal] Subscription ID from header:', subscriptionId);

    if (!subscriptionId) {
      console.log('[OneSignal] No subscription ID in request header, skipping alias sync');
      return;
    }

    try {
      const result = await attachExternalIdToSubscription(subscriptionId, userId);
      console.log('[OneSignal] Alias sync result:', result);
    } catch (error) {
      console.warn('[OneSignal] Alias sync failed:', {
        userId,
        subscriptionId,
        error: error instanceof Error ? error.message : error
      });
    }
  };

  async function updateProgressAfterJournal({ userId, noteDate }) {
    try {
      const timezone = await loadUserTimezone({ supabase, userId });
      const updatedProgress = await incrementJournalProgress({
        supabase,
        userId,
        noteDate,
        timezone,
        eventTimestamp: new Date().toISOString()
      });

      return buildProgressSummary(updatedProgress, timezone);
    } catch (error) {
      console.error('Weekly progress update failed after journal creation:', error);
      return null;
    }
  }

  async function reduceProgressAfterJournal({ userId, noteDate }) {
    try {
      const timezone = await loadUserTimezone({ supabase, userId });
      const updatedProgress = await decrementJournalProgress({
        supabase,
        userId,
        noteDate,
        timezone,
        eventTimestamp: new Date().toISOString()
      });

      return buildProgressSummary(updatedProgress, timezone);
    } catch (error) {
      console.error('Weekly progress update failed after journal deletion:', error);
      return null;
    }
  }

  function toUnixSeconds(isoDate) {
    if (!isoDate) return undefined;
    const timestamp = new Date(isoDate).getTime();
    if (Number.isNaN(timestamp)) return undefined;
    return Math.floor(timestamp / 1000);
  }

  async function syncJournalTags({ userId, weeklyProgress, noteDate }) {
    console.log('[OneSignal] syncJournalTags called:', { userId, weeklyProgress, noteDate });

    if (!onesignalEnabled()) {
      console.log('[OneSignal] Disabled, skipping journal tags sync');
      return;
    }

    const tags = {};

    if (noteDate === null) {
      tags.last_note_ts = '';
    } else if (noteDate) {
      const timestampSeconds = toUnixSeconds(noteDate);
      if (timestampSeconds !== undefined) {
        tags.last_note_ts = timestampSeconds;
      }
    }

    if (weeklyProgress) {
      if (typeof weeklyProgress.meditationsUnlocked === 'boolean') {
        tags.meditation_unlocked = weeklyProgress.meditationsUnlocked ? 'true' : 'false';
      }

      if (typeof weeklyProgress.eligible === 'boolean') {
        tags.weekly_report_eligible = weeklyProgress.eligible ? 'true' : 'false';
      }
    }

    if (tags.weekly_report_eligible === undefined) {
      tags.weekly_report_eligible = 'false';
    }

    console.log('[OneSignal] Constructed journal tags:', { userId, tags, weeklyProgress });

    if (Object.keys(tags).length === 0) {
      console.log('[OneSignal] No tags to sync');
      return;
    }

    try {
      const result = await updateOneSignalUser(userId, tags);
      console.log('[OneSignal] Journal tags synced successfully:', result);
    } catch (error) {
      console.error('[OneSignal] Failed to update journal tags:', {
        userId,
        tags,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  async function emitJournalEvent({ userId, eventName, payload }) {
    console.log('[OneSignal] emitJournalEvent called:', { userId, eventName, payload });

    if (!onesignalEnabled()) {
      console.log('[OneSignal] Disabled, skipping event emission');
      return;
    }

    try {
      const result = await sendOneSignalEvent(userId, eventName, payload);
      console.log('[OneSignal] Event emitted successfully:', { eventName, result });
    } catch (error) {
      console.error('[OneSignal] Failed to send event:', {
        userId,
        eventName,
        payload,
        error: error instanceof Error ? error.message : error
      });
    }
  }

  async function fetchLatestNoteDate(userId) {
    const { data, error } = await supabase
      .from('notes')
      .select('date')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Failed to fetch latest note timestamp:', error);
      return undefined;
    }

    if (!data || data.length === 0) {
      return undefined;
    }

    return data[0]?.date ?? undefined;
  }

  // ============= NOTES API ROUTES =============

  // GET /api/notes - Get user's notes
  app.get('/api/notes', requireAuth(), async (req, res) => {
    try {
      const userId = req.auth.userId;
    
      const { data: notes, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching notes:', error);
        return res.status(500).json({ error: 'Failed to fetch notes' });
      }

      // Transform database column names to camelCase for frontend
      const transformedNotes = notes.map(note => ({
        ...note,
        imageUrl: note.image_url,
        audioUrl: note.audio_url,
        originalCaption: note.original_caption,
        aiImageDescription: note.ai_image_description,
        // Remove the snake_case versions
        image_url: undefined,
        audio_url: undefined,
        original_caption: undefined,
        ai_image_description: undefined
      }));

      res.json({ notes: transformedNotes });
    } catch (error) {
      console.error('Notes fetch error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/notes/date-range - Get notes within date range
  app.get('/api/notes/date-range', requireAuth(), async (req, res) => {
    try {
      const userId = req.auth.userId;
      const { startDate, endDate } = req.query;
    
      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'startDate and endDate are required' });
      }

      // Adjust endDate to include the full day (add one day and use < instead of <=)
      const endDatePlusOne = new Date(endDate);
      endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
      const adjustedEndDate = endDatePlusOne.toISOString().split('T')[0];

      const { data: notes, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startDate)
        .lt('date', adjustedEndDate)  // Use < with next day instead of <= with same day
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching notes by date range:', error);
        return res.status(500).json({ error: 'Failed to fetch notes' });
      }

      // Transform database column names to camelCase for frontend
      const transformedNotes = notes.map(note => ({
        ...note,
        imageUrl: note.image_url,
        audioUrl: note.audio_url,
        originalCaption: note.original_caption,
        aiImageDescription: note.ai_image_description,
        // Remove the snake_case versions
        image_url: undefined,
        audio_url: undefined,
        original_caption: undefined,
        ai_image_description: undefined
      }));

      res.json({ notes: transformedNotes });
    } catch (error) {
      console.error('Date range notes fetch error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/notes/search - Search notes by text query
  app.get('/api/notes/search', requireAuth(), async (req, res) => {
    try {
      const userId = req.auth.userId;
      const { q: query, limit = 50 } = req.query;
    
      // Validate query parameter
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
      }
    
      if (query.length < 3) {
        return res.status(400).json({ error: 'Query must be at least 3 characters long' });
      }
    
      if (query.length > 100) {
        return res.status(400).json({ error: 'Query must be less than 100 characters long' });
      }
    
      // Validate limit parameter
      const limitNum = parseInt(limit, 10);
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        return res.status(400).json({ error: 'Limit must be between 1 and 100' });
      }

      // Perform search query with case-insensitive matching
      // Order by relevance: exact title matches first, then transcript matches, then by date
      const searchPattern = `%${query}%`;
    
      const { data: notes, error } = await supabase
        .from('notes')
        .select('id, title, transcript, date, type, image_url, audio_url, original_caption')
        .eq('user_id', userId)
        .or(`title.ilike.${searchPattern},transcript.ilike.${searchPattern}`)
        .order('date', { ascending: false })
        .limit(limitNum);

      if (error) {
        console.error('Error searching notes:', error);
        return res.status(500).json({ error: 'Failed to search notes' });
      }

      // Generate snippets for matching notes
      const results = notes
        // Ensure newest notes appear first (Supabase already orders, but re-sort defensively)
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .map(note => {
          const titleMatch = note.title && note.title.toLowerCase().includes(query.toLowerCase());
          const transcriptMatch = note.transcript && note.transcript.toLowerCase().includes(query.toLowerCase());

          // Generate snippet from the matching text
          let snippet = { text: '', matchCount: 0 };
          let matchText = '';

          if (titleMatch && note.title) {
            matchText = note.title;
          } else if (transcriptMatch && note.transcript) {
            matchText = note.transcript;
          }

          if (matchText) {
            const lowerMatchText = matchText.toLowerCase();
            const lowerQuery = query.toLowerCase();
            const matchIndex = lowerMatchText.indexOf(lowerQuery);

            if (matchIndex !== -1) {
              // Extract 50 characters before and after the match
              const start = Math.max(0, matchIndex - 50);
              const end = Math.min(matchText.length, matchIndex + query.length + 50);

              let snippetText = matchText.substring(start, end);

              // Add ellipsis if we truncated
              if (start > 0) snippetText = '...' + snippetText;
              if (end < matchText.length) snippetText = snippetText + '...';

              // Count matches in the full text
              const matches = lowerMatchText.split(lowerQuery).length - 1;

              snippet = {
                text: snippetText,
                matchCount: matches
              };
            }
          }

          return {
            id: note.id,
            title: note.title,
            date: note.date,
            type: note.type,
            snippet
          };
        });

      res.json({
        results,
        totalCount: results.length,
        query
      });
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/notes/:id - Get single note by ID
  app.get('/api/notes/:id', requireAuth(), async (req, res) => {
    try {
      const userId = req.auth.userId;
      const { id } = req.params;
    
      if (!id) {
        return res.status(400).json({ error: 'Note ID is required' });
      }

      const { data: note, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', userId)
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ error: 'Note not found' });
        }
        console.error('Error fetching note:', error);
        return res.status(500).json({ error: 'Failed to fetch note' });
      }

      // Transform database column names to camelCase for frontend
      const transformedNote = {
        ...note,
        imageUrl: note.image_url,
        audioUrl: note.audio_url,
        originalCaption: note.original_caption,
        aiImageDescription: note.ai_image_description,
        // Remove the snake_case versions
        image_url: undefined,
        audio_url: undefined,
        original_caption: undefined,
        ai_image_description: undefined
      };

      res.json({ note: transformedNote });
    } catch (error) {
      console.error('Note fetch error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/notes - Create audio note with file upload
  app.post('/api/notes', requireAuth(), upload.single('audio'), async (req, res) => {
    try {
      const userId = req.auth.userId;
      await syncOneSignalAlias(req, userId);
      const { date } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: 'Audio file is required' });
      }

      // Generate unique filename
      const noteId = uuidv4();
      const fileExtension = req.file.originalname.split('.').pop();
      const fileName = `${noteId}.${fileExtension}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('audio')
        .upload(`${userId}/${fileName}`, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        return res.status(500).json({ error: 'Failed to upload audio file' });
      }

      // Get signed URL for the uploaded file
      const { data: urlData } = await supabase.storage
        .from('audio')
        .createSignedUrl(`${userId}/${fileName}`, 3600 * 24 * 365); // 1 year

      // Transcribe audio using Gemini 2.0 Flash Lite
      let transcript = '';
      let title = '';
    
      try {
        const model = gemini.getGenerativeModel({ model: 'gemini-2.0-flash' });
      
        // Convert audio buffer to base64 for Gemini
        const audioBase64 = req.file.buffer.toString('base64');
      
        // Transcribe audio
        const transcribeResult = await model.generateContent([
          {
            inlineData: {
              data: audioBase64,
              mimeType: req.file.mimetype
            }
          },
          'Please transcribe this audio recording. Return only the transcribed text without any additional formatting or commentary.'
        ]);
      
        transcript = transcribeResult.response.text().trim();
      
        // Generate title from transcript
        if (transcript && transcript !== 'Transcription failed') {
          const titleResult = await model.generateContent(
            `Generate a short, meaningful title (max 50 characters) for this transcribed note: "${transcript}". 
            Return only the title text itself. Do not include quotes, labels, explanations, punctuation before/after, or any other text.`
          );
          title = titleResult.response.text().trim().substring(0, 50);
        } else {
          title = 'Audio Note';
        }

      
      } catch (aiError) {
        console.error('AI processing error:', aiError);
        transcript = 'Transcription failed - please try again';
        title = 'Untitled Note';
      }

      // Create note record
      const { data: noteData, error: noteError } = await supabase
        .from('notes')
        .insert([{
          id: noteId,
          user_id: userId,
          title,
          transcript,
          type: 'audio',
          date: date || new Date().toISOString(),
          audio_url: urlData?.signedUrl || `${userId}/${fileName}`,
          duration: 0 // You'd calculate this from the audio file
        }])
        .select()
        .single();

      if (noteError) {
        console.error('Error creating note:', noteError);
        return res.status(500).json({ error: 'Failed to create note' });
      }

      const weeklyProgress = await updateProgressAfterJournal({
        userId,
        noteDate: noteData.date
      });

      // Sync OneSignal operations in sequence to ensure user identity is established
      // before sending tags and events
      if (onesignalEnabled()) {
        console.log('[OneSignal] Starting sync sequence for audio note creation');

        // First, sync alias to link subscription to external_id
        // (already called at line 419, but ensure it completes)

        // Small delay to allow alias attachment to propagate in OneSignal's system
        await new Promise(resolve => setTimeout(resolve, 100));

        // Then sync tags
        await syncJournalTags({
          userId,
          weeklyProgress,
          noteDate: noteData.date,
        });

        // Finally emit event
        await emitJournalEvent({
          userId,
          eventName: 'note_logged',
          payload: {
            note_id: noteId,
            note_type: 'audio',
            timestamp: noteData.date,
          },
        });
      }

      res.status(201).json({
        note: noteData,
        weeklyProgress
      });
    } catch (error) {
      console.error('Audio note creation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/notes/photo - Create photo note with image upload
  app.post('/api/notes/photo', requireAuth(), upload.single('image'), async (req, res) => {
    try {
      const userId = req.auth.userId;
      await syncOneSignalAlias(req, userId);
      const { caption, date } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: 'Image file is required' });
      }

      // Generate unique filename
      const noteId = uuidv4();
      const fileExtension = req.file.originalname.split('.').pop();
      const fileName = `${noteId}.${fileExtension}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(`${userId}/${fileName}`, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        return res.status(500).json({ error: 'Failed to upload image file' });
      }

      // Get signed URL for the uploaded file
      const { data: urlData } = await supabase.storage
        .from('images')
        .createSignedUrl(`${userId}/${fileName}`, 3600 * 24 * 365); // 1 year

      // Enhanced AI processing with Gemini Vision integration
      let aiImageDescription = '';
      let enhancedTranscript = caption || 'No caption provided';
      let title = 'Photo Note';

      try {
        const model = gemini.getGenerativeModel({ model: 'gemini-2.5-flash' });
      
        // Stage 1: Vision Analysis - Analyze the image directly
        try {
          console.log('🔍 Starting Gemini Vision analysis...');
        
          // Convert image buffer to base64 for Gemini Vision
          const imageBase64 = req.file.buffer.toString('base64');
        
          // Vision analysis prompt
          const visionPrompt = `Analyze this image in detail. Describe what you see including: objects, people, setting, colors, lighting, mood, and any notable details. Provide a comprehensive but concise description in 1-3 sentences. Focus on elements that would be meaningful for personal reflection or journaling.`;
        
          const visionResult = await Promise.race([
            model.generateContent([
              visionPrompt,
              {
                inlineData: {
                  data: imageBase64,
                  mimeType: req.file.mimetype
                }
              }
            ]),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Vision analysis timeout')), 30000)
            )
          ]);
        
          aiImageDescription = visionResult.response.text().trim();
          console.log('✅ Vision analysis completed:', aiImageDescription.substring(0, 100) + '...');
        
        } catch (visionError) {
          console.error('❌ Vision analysis failed:', visionError.message);
          // Continue without vision analysis - fallback to text-only processing
        }

        // Stage 2: Caption Combination - Merge user caption with AI image description
        if (aiImageDescription && caption) {
          // Both user caption and AI description available
          enhancedTranscript = `${caption} [AI_ANALYSIS: ${aiImageDescription}]`;
        } else if (aiImageDescription && !caption) {
          // Only AI description available (user provided no caption)
          enhancedTranscript = `[AI_ANALYSIS: ${aiImageDescription}]`;
        } else if (caption && !aiImageDescription) {
          // Only user caption available (vision analysis failed)
          enhancedTranscript = caption;
        }
        // If neither available, keep default 'No caption provided'

        // Ensure combined caption doesn't exceed 1000 characters
        if (enhancedTranscript.length > 1000) {
          // Truncate AI description to fit within limit
          if (caption && aiImageDescription) {
            const availableSpace = 1000 - caption.length - '[AI_ANALYSIS: ]'.length;
            const truncatedAI = aiImageDescription.substring(0, Math.max(0, availableSpace));
            enhancedTranscript = `${caption} [AI_ANALYSIS: ${truncatedAI}]`;
          } else {
            enhancedTranscript = enhancedTranscript.substring(0, 1000);
          }
        }

        console.log('📝 Combined caption created:', enhancedTranscript.substring(0, 100) + '...');

        // Stage 3: Title Generation - Generate title from combined caption
        try {
          const titlePrompt = `Create a short, meaningful title (max 50 characters) for this photo description: "${enhancedTranscript}". Return only the title, no other text.`;
          const titleResult = await model.generateContent(titlePrompt);
          title = titleResult.response.text().trim().substring(0, 50);
        } catch (titleError) {
          console.error('Title generation error:', titleError);
          title = 'Photo Note';
        }


      } catch (aiError) {
        console.error('AI processing error:', aiError);
        // Fallback: use original caption or default
        enhancedTranscript = caption || 'Photo uploaded successfully';
        title = 'Photo Note';
      }

      // Create note record with new ai_image_description field
      const { data: noteData, error: noteError } = await supabase
        .from('notes')
        .insert([{
          id: noteId,
          user_id: userId,
          title,
          transcript: enhancedTranscript,
          type: 'photo',
          date: date || new Date().toISOString(),
          image_url: urlData?.signedUrl || `${userId}/${fileName}`,
          original_caption: caption,
          ai_image_description: aiImageDescription || null
        }])
        .select()
        .single();

      if (noteError) {
        console.error('Error creating photo note:', noteError);
        return res.status(500).json({ error: 'Failed to create photo note' });
      }

      const weeklyProgress = await updateProgressAfterJournal({
        userId,
        noteDate: noteData.date
      });

      // Sync OneSignal operations in sequence
      if (onesignalEnabled()) {
        console.log('[OneSignal] Starting sync sequence for photo note creation');
        await new Promise(resolve => setTimeout(resolve, 100));

        await syncJournalTags({
          userId,
          weeklyProgress,
          noteDate: noteData.date,
        });

        await emitJournalEvent({
          userId,
          eventName: 'note_logged',
          payload: {
            note_id: noteId,
            note_type: 'photo',
            timestamp: noteData.date,
          },
        });
      }

      res.status(201).json({
        note: noteData,
        weeklyProgress
      });
    } catch (error) {
      console.error('Photo note creation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/notes/text - Create text note with optional image upload
  app.post('/api/notes/text', requireAuth(), upload.single('image'), async (req, res) => {
    try {
      const userId = req.auth.userId;
      await syncOneSignalAlias(req, userId);
      const { title: userTitle, content, date } = req.body;

      // Validation
      if (!userTitle || !content) {
        return res.status(400).json({ error: 'Title and content are required' });
      }

      if (userTitle.length > 100) {
        return res.status(400).json({ error: 'Title must be 100 characters or less' });
      }

      if (content.length > 5000) {
        return res.status(400).json({ error: 'Content must be 5000 characters or less' });
      }

      if (content.length < 10) {
        return res.status(400).json({ error: 'Content must be at least 10 characters' });
      }

      // Generate unique note ID
      const noteId = uuidv4();
    
      // Handle optional image upload
      let imageUrl = null;
      let aiImageDescription = null;
    
      if (req.file) {
        // Generate unique filename for image
        const fileExtension = req.file.originalname.split('.').pop();
        const fileName = `${noteId}.${fileExtension}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('images')
          .upload(`${userId}/${fileName}`, req.file.buffer, {
            contentType: req.file.mimetype,
            upsert: false
          });

        if (uploadError) {
          console.error('Storage upload error:', uploadError);
          return res.status(500).json({ error: 'Failed to upload image file' });
        }

        // Get signed URL for the uploaded file
        const { data: urlData } = await supabase.storage
          .from('images')
          .createSignedUrl(`${userId}/${fileName}`, 3600 * 24 * 365); // 1 year

        imageUrl = urlData?.signedUrl || `${userId}/${fileName}`;

        // Optional: AI image analysis for attached photos
        try {
          const model = gemini.getGenerativeModel({ model: 'gemini-2.5-flash' });
        
          console.log('🔍 Starting Gemini Vision analysis for text note image...');
        
          // Convert image buffer to base64 for Gemini Vision
          const imageBase64 = req.file.buffer.toString('base64');
        
          // Vision analysis prompt
          const visionPrompt = `Analyze this image that accompanies a text journal entry. Describe what you see including: objects, people, setting, colors, lighting, mood, and any notable details. Provide a comprehensive but concise description in 1-2 sentences.`;
        
          const visionResult = await Promise.race([
            model.generateContent([
              visionPrompt,
              {
                inlineData: {
                  data: imageBase64,
                  mimeType: req.file.mimetype
                }
              }
            ]),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Vision analysis timeout')), 30000)
            )
          ]);
        
          aiImageDescription = visionResult.response.text().trim();
          console.log('✅ Vision analysis completed for text note image');
        
        } catch (visionError) {
          console.error('❌ Vision analysis failed for text note:', visionError.message);
          // Continue without vision analysis
        }
      }

      // Create note record
      const { data: noteData, error: noteError } = await supabase
        .from('notes')
        .insert([{
          id: noteId,
          user_id: userId,
          title: userTitle, // AI-generated title field (legacy)
          user_title: userTitle, // User-provided title (new field)
          transcript: content, // Using transcript field to store user content
          type: 'text',
          date: date || new Date().toISOString(),
          image_url: imageUrl,
          ai_image_description: aiImageDescription
        }])
        .select()
        .single();

      if (noteError) {
        console.error('Error creating text note:', noteError);
        return res.status(500).json({ error: 'Failed to create text note' });
      }

      const weeklyProgress = await updateProgressAfterJournal({
        userId,
        noteDate: noteData.date
      });

      // Sync OneSignal operations in sequence
      if (onesignalEnabled()) {
        console.log('[OneSignal] Starting sync sequence for text note creation');
        await new Promise(resolve => setTimeout(resolve, 100));

        await syncJournalTags({
          userId,
          weeklyProgress,
          noteDate: noteData.date,
        });

        await emitJournalEvent({
          userId,
          eventName: 'note_logged',
          payload: {
            note_id: noteId,
            note_type: 'text',
            timestamp: noteData.date,
          },
        });
      }

      res.status(201).json({
        note: noteData,
        weeklyProgress
      });
    } catch (error) {
      console.error('Text note creation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // DELETE /api/notes/:id - Delete user's note
  app.delete('/api/notes/:id', requireAuth(), async (req, res) => {
    try {
      const userId = req.auth.userId;
      await syncOneSignalAlias(req, userId);
      const noteId = req.params.id;

      // First get the note to check ownership and get file URLs
      const { data: note, error: fetchError } = await supabase
        .from('notes')
        .select('*')
        .eq('id', noteId)
        .eq('user_id', userId)
        .single();

      if (fetchError || !note) {
        return res.status(404).json({ error: 'Note not found' });
      }

      // Delete associated files from storage
      try {
        if (note.audio_url && note.type === 'audio') {
          const filePath = note.audio_url.split('/').slice(-2).join('/'); // Get last two parts
          await supabase.storage.from('audio').remove([filePath]);
        }
      
        if (note.image_url && note.type === 'photo') {
          const filePath = note.image_url.split('/').slice(-2).join('/'); // Get last two parts
          await supabase.storage.from('images').remove([filePath]);
        }
      } catch (storageError) {
        console.error('Storage deletion error:', storageError);
        // Continue with note deletion even if file deletion fails
      }

      // Delete the note record
      const { error: deleteError } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteId)
        .eq('user_id', userId);

      if (deleteError) {
        console.error('Error deleting note:', deleteError);
        return res.status(500).json({ error: 'Failed to delete note' });
      }

      const weeklyProgress = await reduceProgressAfterJournal({
        userId,
        noteDate: note.date
      });

      let latestNoteDate;
      if (onesignalEnabled()) {
        latestNoteDate = await fetchLatestNoteDate(userId);
      }

      await syncJournalTags({
        userId,
        weeklyProgress,
        noteDate: latestNoteDate ?? null,
      });

      await emitJournalEvent({
        userId,
        eventName: 'note_deleted',
        payload: {
          note_id: noteId,
          note_type: note.type,
          timestamp: note.date,
        },
      });

      res.json({ message: 'Note deleted successfully', weeklyProgress });
    } catch (error) {
      console.error('Note deletion error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // PUT /api/notes/:id - Update user's note
  app.put('/api/notes/:id', requireAuth(), async (req, res) => {
    try {
      const userId = req.auth.userId;
      await syncOneSignalAlias(req, userId);
      const noteId = req.params.id;
      const { title, transcript } = req.body;

      // Validate required fields
      if (!title || !transcript) {
        return res.status(400).json({ error: 'Title and transcript are required' });
      }

      // Check if note exists and belongs to user
      const { data: existingNote, error: fetchError } = await supabase
        .from('notes')
        .select('id')
        .eq('id', noteId)
        .eq('user_id', userId)
        .single();

      if (fetchError || !existingNote) {
        return res.status(404).json({ error: 'Note not found' });
      }

      // Update the note
      const { data: updatedNote, error: updateError } = await supabase
        .from('notes')
        .update({
          title: title.trim(),
          transcript: transcript.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', noteId)
        .eq('user_id', userId)
        .select('*')
        .single();

      if (updateError) {
        console.error('Error updating note:', updateError);
        return res.status(500).json({ error: 'Failed to update note' });
      }

      res.json({ 
        message: 'Note updated successfully',
        note: updatedNote
      });
    } catch (error) {
      console.error('Note update error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}
