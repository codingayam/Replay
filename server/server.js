import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import multer from 'multer';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Replicate from 'replicate';

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
      // Remove the snake_case versions
      image_url: undefined,
      audio_url: undefined,
      original_caption: undefined
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
      // Remove the snake_case versions
      image_url: undefined,
      audio_url: undefined,
      original_caption: undefined
    }));

    res.json({ notes: transformedNotes });
  } catch (error) {
    console.error('Date range notes fetch error:', error);
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

    // Enhance caption and generate title using Gemini
    let enhancedTranscript = caption || 'No caption provided';
    let title = 'Photo Note';
    let categories = [];

    try {
      if (caption) {
        const model = gemini.getGenerativeModel({ model: 'gemini-2.5-flash' });
        
        // Generate enhanced description
        const enhancePrompt = `Describe this photo alongside the ${caption}`;
        const enhanceResult = await model.generateContent(enhancePrompt);
        enhancedTranscript = enhanceResult.response.text();

        // Generate title
        const titlePrompt = `Create a short, meaningful title (max 50 characters) for this photo description: "${enhancedTranscript}". Return only the title, no other text.`;
        const titleResult = await model.generateContent(titlePrompt);
        title = titleResult.response.text().substring(0, 50);

        // Generate categories from caption and enhanced description
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
      }
    } catch (aiError) {
      console.error('AI processing error:', aiError);
    }

    // Create note record
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
        original_caption: caption
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
    const { name, values, mission } = req.body;

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
          mission
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
      .select('name, values, mission')
      .eq('user_id', userId)
      .single();

    try {
      const model = gemini.getGenerativeModel({ model: 'gemini-2.5-flash' });
      
      const experiencesText = notes.map(note => 
        `${note.date}: ${note.title}\n${note.transcript}`
      ).join('\n\n---\n\n');

      const profileContext = profile ? `
        User's name: ${profile.name || 'User'}
        Personal values: ${profile.values || 'Not specified'}
        Life mission: ${profile.mission || 'Not specified'}
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
    const { noteIds, duration = 10, title, summary } = req.body;

    if (!noteIds || !Array.isArray(noteIds) || noteIds.length === 0) {
      return res.status(400).json({ error: 'noteIds array is required' });
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
      .select('name, values, mission')
      .eq('user_id', userId)
      .single();

    try {
      const model = gemini.getGenerativeModel({ model: 'gemini-2.5-flash' });
      
      const experiencesText = notes.map(note => 
        `${note.date}: ${note.title}\n${note.transcript}`
      ).join('\n\n---\n\n');

      const profileContext = profile ? `
        User's name: ${profile.name || 'User'}
        Personal values: ${profile.values || 'Not specified'}
        Life mission: ${profile.mission || 'Not specified'}
      ` : '';

      const scriptPrompt = `
        You are an experienced meditation practitioner. You are great at taking raw experiences and sensory data and converting them into a ${duration}-minute meditation session. Your role is to provide a focused, reflective space for life's meaningful moments. The guided reflection should be thoughtful and not cloying, with pauses for quiet reflection using the format [PAUSE=Xs], where X is the number of seconds. You are trusted to decide on the duration and number of pauses. Create a guided meditation script based on the following information:
        
        ${profileContext}
        
        Experiences:
        ${experiencesText}
        
        Reflection summary: ${summary || 'Based on selected experiences'}
        
        Make sure that the opening and closing of the meditation is appropriate and eases them into the meditation and also at the closing, prepares them for rest and recharge.
        
        
        IMPORTANT: Write the script as plain spoken text only. Do not use any markdown formatting, asterisks. You are only allowed to use the format [PAUSE=Xs] for pauses. Do not include section headers or timestamps like "**Breathing Guidance (1 minute 30 seconds)**". Also, there should not be any pauses after the last segment.
      `;

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

      // Generate TTS for meditation segments
      const segments = script.split(/\[PAUSE=(\d+)s\]/);
      const playlist = [];

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i].trim();
        
        if (segment && isNaN(segment)) {
          // This is a speech segment, generate TTS
          try {
            console.log(`🔊 Generating TTS for segment ${playlist.length}: "${segment.substring(0, 100)}${segment.length > 100 ? '...' : ''}"`);
            
            const replicateInput = {
              text: segment,
              voice: "af_nicole",
              speed: 0.7
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
            
            // Upload TTS audio to Supabase Storage
            const audioResponse = await fetch(audioUrl);
            const arrayBuffer = await audioResponse.arrayBuffer();
            const audioBuffer = Buffer.from(arrayBuffer);
            
            const audioFileName = `${meditationId}-segment-${playlist.length}.wav`;
            const { data: audioUpload, error: audioError } = await supabase.storage
              .from('meditations')
              .upload(`${userId}/${audioFileName}`, audioBuffer, {
                contentType: 'audio/wav',
                upsert: false
              });

            if (!audioError) {
              const { data: urlData } = await supabase.storage
                .from('meditations')
                .createSignedUrl(`${userId}/${audioFileName}`, 3600 * 24 * 30); // 30 days

              console.log(`✅ Audio uploaded successfully: ${audioFileName}`);
              playlist.push({
                type: 'speech',
                audioUrl: urlData?.signedUrl || `${userId}/${audioFileName}`,
                duration: Math.ceil(segment.length / 10) // Rough estimate: 10 characters per second
              });
            } else {
              console.error('❌ Audio upload error:', audioError);
              // Fallback: store without audio - frontend will skip segments without audioUrl
              playlist.push({
                type: 'speech',
                duration: Math.ceil(segment.length / 10)
              });
            }

          } catch (ttsError) {
            console.error('❌ TTS generation failed for segment:', ttsError);
            console.error('Segment text:', segment.substring(0, 200));
            // Fallback: store without audio - frontend will skip segments without audioUrl
            playlist.push({
              type: 'speech',
              duration: Math.ceil(segment.length / 10)
            });
          }
        } else if (!isNaN(segment)) {
          // This is a pause duration
          const pauseDuration = parseInt(segment);
          console.log(`⏸️ Adding pause: ${pauseDuration} seconds`);
          playlist.push({
            type: 'pause',
            duration: pauseDuration
          });
        }
      }

      // Calculate total duration
      const totalDuration = playlist.reduce((sum, item) => sum + item.duration, 0);
      
      console.log('🎵 Meditation generation complete:');
      console.log(`- Total segments: ${playlist.length}`);
      console.log(`- Speech segments: ${playlist.filter(item => item.type === 'speech').length}`);
      console.log(`- Pause segments: ${playlist.filter(item => item.type === 'pause').length}`);
      console.log(`- Total duration: ${totalDuration} seconds`);

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
          summary: summary || 'Generated meditation from personal experiences',
          time_of_reflection: new Date().toISOString()
        }])
        .select()
        .single();

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
});

export default app;