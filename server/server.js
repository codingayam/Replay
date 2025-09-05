import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import multer from 'multer';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Replicate from 'replicate';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

// Load environment variables
dotenv.config();

// Get current directory (ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import middleware
import { requireAuth, optionalAuth, supabase } from './middleware/auth.js';

// Initialize AI services
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// Initialize Express app
const app = express();
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
          const getVoiceSettings = (reflectionType) => {
            if (reflectionType === 'Ideas') {
              return { voice: "af_bella", speed: 1.0 };
            }
            // Default for Night and other reflection types
            return { voice: "af_nicole", speed: 0.7 };
          };
          
          const voiceSettings = getVoiceSettings(reflectionType);
          
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
          // Create meaningful pause based on text length (better UX than tiny silence)
          const pauseDuration = Math.max(3, Math.ceil(segment.length / 20)); // ~3 seconds minimum, estimate reading time
          const tempFileName = path.join(tempDir, `segment-${i}-speech.wav`);
          await execAsync(`ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t ${pauseDuration} -c:a pcm_s16le "${tempFileName}"`);
          tempAudioFiles.push(tempFileName);
          console.log(`📝 TTS fallback: Created ${pauseDuration}s pause for "${segment.substring(0, 50)}..."`);
        }
      } else if (!isNaN(segment)) {
        // Pause segment
        let pauseDuration = parseInt(segment);
        if (isNaN(pauseDuration) || pauseDuration <= 0) {
          console.log(`⚠️ Invalid pause duration: ${segment}, using 3 seconds default`);
          pauseDuration = 3;
        }
        const tempFileName = path.join(tempDir, `segment-${i}-pause.wav`);
        await execAsync(`ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t ${pauseDuration} -c:a pcm_s16le "${tempFileName}"`);
        tempAudioFiles.push(tempFileName);
      }
    }

    // Concatenate all audio files
    const concatListPath = path.join(tempDir, 'concat_list.txt');
    const concatList = tempAudioFiles.map(file => `file '${file}'`).join('\n');
    fs.writeFileSync(concatListPath, concatList);
    
    const finalAudioPath = path.join(tempDir, `${meditationId}-complete.wav`);
    await execAsync(`ffmpeg -f concat -safe 0 -i "${concatListPath}" -c copy "${finalAudioPath}"`);
    
    // Upload final audio file
    const finalAudioBuffer = fs.readFileSync(finalAudioPath);
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
      
      // Process the claimed job
      processMeditationJob(claimedJob).catch(error => {
        console.error(`Background job processing error:`, error);
      });
    }
  } catch (error) {
    console.error('Job queue processing error:', error);
  }
}

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
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
      .select('id, title, transcript, date, type, category, image_url, audio_url, original_caption')
      .eq('user_id', userId)
      .or(`title.ilike.${searchPattern},transcript.ilike.${searchPattern}`)
      .order('date', { ascending: false })
      .limit(limitNum);

    if (error) {
      console.error('Error searching notes:', error);
      return res.status(500).json({ error: 'Failed to search notes' });
    }

    // Generate snippets and calculate relevance scores
    const results = notes.map(note => {
      const titleMatch = note.title && note.title.toLowerCase().includes(query.toLowerCase());
      const transcriptMatch = note.transcript && note.transcript.toLowerCase().includes(query.toLowerCase());
      
      // Calculate relevance score (title matches get higher score)
      let relevanceScore = 0.5;
      if (titleMatch) relevanceScore += 0.4;
      if (transcriptMatch) relevanceScore += 0.1;
      
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
        category: note.category,
        snippet,
        relevanceScore
      };
    });
    
    // Sort by relevance score (highest first), then by date (newest first)
    results.sort((a, b) => {
      if (a.relevanceScore !== b.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      return new Date(b.date) - new Date(a.date);
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
    const { date } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Audio file is required' });
    }

    // Generate unique filename
    const noteId = uuidv4();
    const fileExtension = req.file.originalname.split('.').pop();
    const fileName = `${noteId}.${fileExtension}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
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
    let categories = [];
    
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

      // Generate categories from transcript
      if (transcript && transcript !== 'Transcription failed') {
        try {
          const categoryResult = await model.generateContent(
            `Analyze this transcribed note and determine which categories apply: "${transcript}".
            
            Categories:
            - "ideas": Content that represents thoughts, concepts, plans, solutions, creative insights, or intellectual reflections
            - "feelings": Content that represents emotions, emotional experiences, mood, personal reactions, or emotional processing
            
            A note can have both categories if it contains both ideas and emotional content.
            
            Respond with ONLY a JSON array containing the applicable categories. Examples:
            ["ideas"] - if only ideas/thoughts
            ["feelings"] - if only emotions/feelings  
            ["ideas", "feelings"] - if both are present
            
            Return only the JSON array, no other text.`
          );
          
          const categoryText = categoryResult.response.text().trim();
          try {
            const parsedCategories = JSON.parse(categoryText);
            if (Array.isArray(parsedCategories)) {
              // Validate that all categories are valid
              const validCategories = parsedCategories.filter(cat => 
                cat === 'ideas' || cat === 'feelings'
              );
              if (validCategories.length > 0) {
                categories = validCategories;
              }
            }
          } catch (parseError) {
            console.error('Category parsing error:', parseError);
          }
        } catch (categoryError) {
          console.error('Category generation error:', categoryError);
        }
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
        category: categories.length > 0 ? categories : null,
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

    res.status(201).json({ note: noteData });
  } catch (error) {
    console.error('Audio note creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/notes/photo - Create photo note with image upload
app.post('/api/notes/photo', requireAuth(), upload.single('image'), async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { caption, date } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    // Generate unique filename
    const noteId = uuidv4();
    const fileExtension = req.file.originalname.split('.').pop();
    const fileName = `${noteId}.${fileExtension}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
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
    let categories = [];

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

      // Stage 4: Categorization - Generate categories from combined caption
      try {
        const categoryResult = await model.generateContent(
          `Analyze this photo note and determine which categories apply: "${enhancedTranscript}".
          
          Categories:
          - "ideas": Content that represents thoughts, concepts, plans, solutions, creative insights, or intellectual reflections
          - "feelings": Content that represents emotions, emotional experiences, mood, personal reactions, or emotional processing
          
          A note can have both categories if it contains both ideas and emotional content.
          
          Respond with ONLY a JSON array containing the applicable categories. Examples:
          ["ideas"] - if only ideas/thoughts
          ["feelings"] - if only emotions/feelings  
          ["ideas", "feelings"] - if both are present
          
          Return only the JSON array, no other text.`
        );
        
        const categoryText = categoryResult.response.text().trim();
        try {
          const parsedCategories = JSON.parse(categoryText);
          if (Array.isArray(parsedCategories)) {
            // Validate that all categories are valid
            const validCategories = parsedCategories.filter(cat => 
              cat === 'ideas' || cat === 'feelings'
            );
            if (validCategories.length > 0) {
              categories = validCategories;
            }
          }
        } catch (parseError) {
          console.error('Category parsing error:', parseError);
        }
      } catch (categoryError) {
        console.error('Category generation error:', categoryError);
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
        category: categories.length > 0 ? categories : null,
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

    res.status(201).json({ note: noteData });
  } catch (error) {
    console.error('Photo note creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/notes/:id - Delete user's note
app.delete('/api/notes/:id', requireAuth(), async (req, res) => {
  try {
    const userId = req.auth.userId;
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

    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Note deletion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============= PROFILE API ROUTES =============

// GET /api/profile - Get user profile
app.get('/api/profile', requireAuth(), async (req, res) => {
  try {
    const userId = req.auth.userId;

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching profile:', error);
      return res.status(500).json({ error: 'Failed to fetch profile' });
    }

    // If no profile exists, return null (user hasn't completed onboarding)
    if (!profile) {
      return res.json({ profile: null });
    }

    res.json({ profile });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/profile - Update user profile
app.post('/api/profile', requireAuth(), async (req, res) => {
  try {
    const userId = req.auth.userId;
    const { name, values, mission, thinking_about } = req.body;

    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .single();

    let profileData;

    if (existingProfile) {
      // Update existing profile
      const { data, error } = await supabase
        .from('profiles')
        .update({
          name,
          values,
          mission,
          thinking_about,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('Error updating profile:', error);
        return res.status(500).json({ error: 'Failed to update profile' });
      }

      profileData = data;
    } else {
      // Create new profile
      const { data, error } = await supabase
        .from('profiles')
        .insert([{
          user_id: userId,
          name,
          values,
          mission,
          thinking_about
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating profile:', error);
        return res.status(500).json({ error: 'Failed to create profile' });
      }

      profileData = data;
    }

    res.json({ profile: profileData });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/profile/image - Upload profile image
app.post('/api/profile/image', requireAuth(), upload.single('profileImage'), async (req, res) => {
  try {
    const userId = req.auth.userId;

    if (!req.file) {
      return res.status(400).json({ error: 'Profile image file is required' });
    }

    // Generate unique filename
    const imageId = uuidv4();
    const fileExtension = req.file.originalname.split('.').pop();
    const fileName = `${imageId}.${fileExtension}`;

    // Delete old profile image if it exists
    try {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('profile_image_url')
        .eq('user_id', userId)
        .single();

      if (existingProfile?.profile_image_url) {
        // Extract file path from existing URL for deletion
        const oldFilePath = existingProfile.profile_image_url.split('/').slice(-2).join('/');
        await supabase.storage.from('profiles').remove([oldFilePath]);
      }
    } catch (deleteError) {
      console.error('Error deleting old profile image:', deleteError);
      // Continue with upload even if deletion fails
    }

    // Upload new profile image to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('profiles')
      .upload(`${userId}/${fileName}`, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return res.status(500).json({ error: 'Failed to upload profile image' });
    }

    // Get signed URL for the uploaded file
    const { data: urlData } = await supabase.storage
      .from('profiles')
      .createSignedUrl(`${userId}/${fileName}`, 3600 * 24 * 365); // 1 year

    // Update profile with new image URL
    const { data: profileData, error: updateError } = await supabase
      .from('profiles')
      .update({
        profile_image_url: urlData?.signedUrl || `${userId}/${fileName}`,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating profile with image URL:', updateError);
      return res.status(500).json({ error: 'Failed to update profile with image' });
    }

    res.json({ 
      profile: profileData,
      imageUrl: urlData?.signedUrl || `${userId}/${fileName}`
    });
  } catch (error) {
    console.error('Profile image upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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
      const tempDir = path.join(__dirname, 'temp', meditationId);
      
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
              const getVoiceSettings = (reflectionType) => {
                if (reflectionType === 'Ideas') {
                  return { voice: "af_bella", speed: 1.0 };
                }
                // Default for Night and other reflection types
                return { voice: "af_nicole", speed: 0.7 };
              };
              
              const voiceSettings = getVoiceSettings(reflectionType);
              
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
              
              const tempFileName = path.join(tempDir, `segment-${i}-speech.wav`);
              fs.writeFileSync(tempFileName, audioBuffer);
              tempAudioFiles.push(tempFileName);
              
              console.log(`✅ TTS segment saved: ${tempFileName}`);

            } catch (ttsError) {
              console.error('❌ TTS generation failed for segment:', ttsError);
              console.error('Segment text:', segment.substring(0, 200));
              // Create a very short silence file as fallback
              const tempFileName = path.join(tempDir, `segment-${i}-speech.wav`);
              await execAsync(`ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 0.1 -c:a pcm_s16le "${tempFileName}"`);
              tempAudioFiles.push(tempFileName);
            }
          } else if (!isNaN(segment)) {
            // This is a pause duration, create silent audio
            let pauseDuration = parseInt(segment);
            if (isNaN(pauseDuration) || pauseDuration <= 0) {
              console.log(`⚠️ Invalid pause duration: ${segment}, using 3 seconds default`);
              pauseDuration = 3;
            }
            console.log(`⏸️ Creating silence: ${pauseDuration} seconds`);
            
            const tempFileName = path.join(tempDir, `segment-${i}-pause.wav`);
            await execAsync(`ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t ${pauseDuration} -c:a pcm_s16le "${tempFileName}"`);
            tempAudioFiles.push(tempFileName);
            
            console.log(`✅ Silence segment created: ${tempFileName}`);
          }
        }

        // Create FFmpeg concat file list
        const concatListPath = path.join(tempDir, 'concat_list.txt');
        const concatList = tempAudioFiles.map(file => `file '${file}'`).join('\n');
        fs.writeFileSync(concatListPath, concatList);
        
        // Concatenate all audio files into one continuous file
        const finalAudioPath = path.join(tempDir, `${meditationId}-complete.wav`);
        console.log('🎵 Concatenating audio segments...');
        
        await execAsync(`ffmpeg -f concat -safe 0 -i "${concatListPath}" -c copy "${finalAudioPath}"`, {
          maxBuffer: 10 * 1024 * 1024 // 10MB buffer to handle FFmpeg warnings
        });
        
        console.log('✅ Audio concatenation complete');
        
        // Upload the final continuous audio file to Supabase
        const finalAudioBuffer = fs.readFileSync(finalAudioPath);
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
      .select('*')
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

// GET stats endpoints
app.get('/api/stats/streak', requireAuth(), async (req, res) => {
  try {
    const userId = req.auth.userId;
    
    // Calculate current streak based on meditation dates
    const { data: meditations, error } = await supabase
      .from('meditations')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching meditations for streak:', error);
      return res.status(500).json({ error: 'Failed to calculate streak' });
    }

    // Simple streak calculation - count consecutive days with meditations
    let streak = 0;
    if (meditations && meditations.length > 0) {
      // For now, return a simple calculation based on total meditations
      streak = Math.min(meditations.length, 30); // Cap at 30 for demo
    }

    res.json({ streak });
  } catch (error) {
    console.error('Streak calculation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/stats/monthly', requireAuth(), async (req, res) => {
  try {
    const userId = req.auth.userId;
    
    // Get this month's meditation count
    const currentMonth = new Date();
    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

    const { data: meditations, error } = await supabase
      .from('meditations')
      .select('id')
      .eq('user_id', userId)
      .gte('created_at', startOfMonth.toISOString())
      .lte('created_at', endOfMonth.toISOString());

    if (error) {
      console.error('Error fetching monthly stats:', error);
      return res.status(500).json({ error: 'Failed to get monthly count' });
    }

    const count = meditations ? meditations.length : 0;
    res.json({ count });
  } catch (error) {
    console.error('Monthly stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/stats/calendar', requireAuth(), async (req, res) => {
  try {
    const userId = req.auth.userId;
    
    // Get all meditation dates for calendar
    const { data: meditations, error } = await supabase
      .from('meditations')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching calendar data:', error);
      return res.status(500).json({ error: 'Failed to get calendar data' });
    }

    // Extract unique dates
    const dates = meditations 
      ? meditations.map(m => new Date(m.created_at).toISOString().split('T')[0])
      : [];
    
    const uniqueDates = [...new Set(dates)];
    res.json({ dates: uniqueDates });
  } catch (error) {
    console.error('Calendar stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// File serving routes for Supabase Storage signed URLs
app.get('/api/files/profiles/:userId/:filename', requireAuth(), async (req, res) => {
  try {
    const { userId, filename } = req.params;
    const authUserId = req.auth.userId;
    
    // Ensure user can only access their own files
    if (userId !== authUserId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const filePath = `${userId}/${filename}`;
    const { data, error } = await supabase.storage
      .from('profiles')
      .createSignedUrl(filePath, 3600); // 1 hour expiry
    
    if (error) {
      console.error('Profile image signed URL error:', error);
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.json({ signedUrl: data.signedUrl });
  } catch (error) {
    console.error('Profile file serving error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/files/images/:userId/:filename', requireAuth(), async (req, res) => {
  try {
    const { userId, filename } = req.params;
    const authUserId = req.auth.userId;
    
    // Ensure user can only access their own files
    if (userId !== authUserId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const filePath = `${userId}/${filename}`;
    const { data, error } = await supabase.storage
      .from('images')
      .createSignedUrl(filePath, 3600); // 1 hour expiry
    
    if (error) {
      console.error('Note image signed URL error:', error);
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.json({ signedUrl: data.signedUrl });
  } catch (error) {
    console.error('Image file serving error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/files/audio/:userId/:filename', requireAuth(), async (req, res) => {
  try {
    const { userId, filename } = req.params;
    const authUserId = req.auth.userId;
    
    // Ensure user can only access their own files  
    if (userId !== authUserId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const filePath = `${userId}/${filename}`;
    const { data, error } = await supabase.storage
      .from('audio')
      .createSignedUrl(filePath, 3600); // 1 hour expiry
    
    if (error) {
      console.error('Audio file signed URL error:', error);
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.json({ signedUrl: data.signedUrl });
  } catch (error) {
    console.error('Audio file serving error:', error);
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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Replay server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API base: http://localhost:${PORT}/api`);
  
  // Start background job worker
  console.log(`⚙️ Starting background job worker...`);
  jobWorkerInterval = setInterval(processJobQueue, 10000); // Check for jobs every 10 seconds
  
  // Initial check for pending jobs
  processJobQueue().catch(error => {
    console.error('Initial job queue check failed:', error);
  });
});

export default app;