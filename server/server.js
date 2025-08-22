

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const Replicate = require('replicate');
const wav = require('wav');
const { clerkMiddleware, requireAuth } = require('@clerk/express');
const { db } = require('./database');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3001;

// --- MIDDLEWARE ---
// CORS configuration for production
const corsOptions = {
    origin: [
        'http://localhost:5173', // Local development
        'https://replay-psi.vercel.app' // Production frontend
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());

// Clerk Authentication Middleware
app.use(clerkMiddleware());

// Serve static files from React build
app.use(express.static(path.join(__dirname, '../client/dist')));

// File serving endpoints - now using Supabase Storage
app.get('/audio/:userId/:filename', requireAuth(), async (req, res) => {
    try {
        // Verify user can access this audio
        if (req.auth?.userId !== req.params.userId) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const { data, error } = await supabase.storage
            .from('audio')
            .createSignedUrl(`${req.params.userId}/${req.params.filename}`, 3600); // 1 hour expiry
            
        if (error) throw error;
        
        res.redirect(data.signedUrl);
    } catch (error) {
        console.error('Error serving audio file:', error);
        res.status(404).json({ error: 'File not found' });
    }
});

app.get('/images/:userId/:filename', requireAuth(), async (req, res) => {
    try {
        // Verify user can access this image
        if (req.auth?.userId !== req.params.userId) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const { data, error } = await supabase.storage
            .from('images')
            .createSignedUrl(`${req.params.userId}/${req.params.filename}`, 3600); // 1 hour expiry
            
        if (error) throw error;
        
        res.redirect(data.signedUrl);
    } catch (error) {
        console.error('Error serving image file:', error);
        res.status(404).json({ error: 'File not found' });
    }
});

app.get('/meditations/:filename', requireAuth(), async (req, res) => {
    try {
        const { data, error } = await supabase.storage
            .from('meditations')
            .createSignedUrl(`${req.params.filename}`, 3600); // 1 hour expiry
            
        if (error) throw error;
        
        res.redirect(data.signedUrl);
    } catch (error) {
        console.error('Error serving meditation file:', error);
        res.status(404).json({ error: 'File not found' });
    }
});

// --- STORAGE SETUP ---
// File storage migrated to Supabase Storage
// Local file paths no longer needed

// Audio upload storage - using memory storage for Supabase upload
const uploadAudio = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Image upload storage - using memory storage for Supabase upload
const uploadImage = multer({ 
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    },
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Profile picture upload storage (same as images)
const uploadProfileImage = multer({ 
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    },
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// --- API CLIENTS ---
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const replicate = process.env.REPLICATE_API_TOKEN ? new Replicate({ auth: process.env.REPLICATE_API_TOKEN }) : null;

// Supabase client for storage
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// --- AUTH HELPERS ---
// Using Clerk's built-in requireAuth middleware

// --- HELPERS ---


async function saveWaveFile(
    filename,
    pcmData,
    channels = 1,
    rate = 24000,
    sampleWidth = 2,
) {
    return new Promise((resolve, reject) => {
        const writer = new wav.FileWriter(filename, {
            channels,
            sampleRate: rate,
            bitDepth: sampleWidth * 8,
        });

        writer.on('finish', resolve);
        writer.on('error', reject);

        writer.write(pcmData);
        writer.end();
    });
}

const readData = async (filePath) => {
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        // If file is empty, return null so the caller can decide on a default.
        return data ? JSON.parse(data) : null;
    } catch (error) {
        // If file doesn't exist, also return null.
        if (error.code === 'ENOENT') {
            return null;
        }
        throw error;
    }
};

const writeData = async (filePath, data) => {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
};

// --- SUPABASE STORAGE HELPERS ---
const uploadFileToSupabase = async (bucket, filePath, fileBuffer, contentType) => {
    const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, fileBuffer, {
            contentType,
            duplex: 'half'
        });
        
    if (error) throw error;
    return data;
};

const getFileUrl = async (bucket, filePath) => {
    const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, 3600); // 1 hour expiry
        
    if (error) throw error;
    return data.signedUrl;
};

// --- API ROUTES ---

// Debug endpoint
app.get('/api/debug', (req, res) => {
    res.json({
        message: 'Railway backend is working!',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// -- Notes --
app.get('/api/notes', requireAuth(), async (req, res) => {
    try {
        const notes = await db.getNotes(req.auth.userId);
        res.json(notes);
    } catch (error) {
        console.error('Error fetching notes:', error);
        res.status(500).json({ error: 'Failed to fetch notes' });
    }
});

// Get notes within a date range
app.get('/api/notes/date-range', requireAuth(), async (req, res) => {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Both startDate and endDate are required.' });
    }
    
    try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        // Set end date to end of day
        end.setHours(23, 59, 59, 999);
        
        const notes = await db.getNotesInDateRange(req.auth.userId, start.toISOString(), end.toISOString());
        res.json(notes);
    } catch (error) {
        console.error('Error filtering notes by date range:', error);
        res.status(400).json({ error: 'Invalid date format. Use ISO format (YYYY-MM-DD).' });
    }
});

app.post('/api/notes', requireAuth(), uploadAudio.single('audio'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Audio file is required.' });
    }
    
    try {
        const userId = req.auth.userId;
        const filename = `${uuidv4()}.wav`;
        const filePath = `${userId}/${filename}`;
        
        // Upload file to Supabase Storage
        await uploadFileToSupabase('audio', filePath, req.file.buffer, 'audio/wav');
        
        // Check if AI service is available
        if (!genAI) {
            // Fallback when AI service is not available
            const noteData = {
                id: uuidv4(),
                title: 'Audio Note',
                transcript: 'Transcription not available (AI service not configured)',
                category: 'experience',
                type: 'audio',
                date: req.body.localTimestamp || new Date().toISOString(),
                duration: 0,
                audioUrl: `/audio/${userId}/${filename}`,
            };
            const newNote = await db.createNote(userId, noteData);
            return res.status(201).json(newNote);
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
        
        // 1. Generate Transcript using the file buffer
        const audioBase64 = req.file.buffer.toString('base64');
        const audioPart = {
            inlineData: {
                data: audioBase64,
                mimeType: 'audio/wav',
            },
        };
        const prompt = `Please analyze this audio and provide:
1. A complete transcription
2. A short, concise title (4-5 words max) 
3. Classification into one of these categories:
   - "experience": Personal experiences, events, feelings, daily activities
   - "knowledge": Learning, insights, facts, discoveries, realizations

Return as JSON:
{
  "transcript": "full transcription here",
  "title": "Short Title Here",
  "category": "experience|knowledge"
}`;

        const result = await model.generateContent([prompt, audioPart]);
        const responseText = result.response.text();
        console.log("AI Response:", responseText);
        
        let parsedResponse;
        try {
            // Extract JSON from response (in case there's extra text)
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            const jsonString = jsonMatch ? jsonMatch[0] : responseText;
            parsedResponse = JSON.parse(jsonString);
        } catch (parseError) {
            console.error('Failed to parse AI response as JSON:', parseError);
            // Fallback to default values
            parsedResponse = {
                transcript: 'No transcript available.',
                title: 'Untitled Note',
                category: 'experience'
            };
        }

        console.log("Generated Title:", parsedResponse.title);
        console.log("Generated Category:", parsedResponse.category);

        const noteData = {
            id: uuidv4(),
            title: parsedResponse.title || 'Untitled Note',
            transcript: parsedResponse.transcript || 'No transcript available.',
            category: parsedResponse.category || 'experience',
            type: 'audio',
            date: req.body.localTimestamp || new Date().toISOString(),
            duration: 0, // Placeholder, can be implemented with an audio library
            audioUrl: `/audio/${userId}/${filename}`,
        };
        
        const newNote = await db.createNote(userId, noteData);
        res.status(201).json(newNote);
    } catch (error) {
        console.error('Error processing note with AI:', error);
        res.status(500).json({ error: 'Failed to process note with AI.' });
    }
});

// Photo upload endpoint
app.post('/api/notes/photo', requireAuth(), uploadImage.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Image file is required.' });
    }
    
    const { caption } = req.body;
    if (!caption || !caption.trim()) {
        return res.status(400).json({ error: 'Caption is required.' });
    }

    try {
        const userId = req.auth.userId;
        const filename = `${uuidv4()}${path.extname(req.file.originalname)}`;
        const filePath = `${userId}/${filename}`;
        
        // Upload file to Supabase Storage
        await uploadFileToSupabase('images', filePath, req.file.buffer, req.file.mimetype);
        
        // Check if AI service is available
        if (!genAI) {
            // Fallback when AI service is not available
            const noteData = {
                id: uuidv4(),
                title: 'Photo Note',
                transcript: caption,
                originalCaption: caption,
                type: 'photo',
                date: req.body.localTimestamp || new Date().toISOString(),
                imageUrl: `/images/${userId}/${filename}`,
                category: 'experience'
            };
            const newNote = await db.createNote(userId, noteData);
            return res.status(201).json(newNote);
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
        
        // Use the file buffer for AI processing
        const imageBase64 = req.file.buffer.toString('base64');
        const imagePart = {
            inlineData: {
                data: imageBase64,
                mimeType: req.file.mimetype,
            },
        };

        // Generate enhanced caption using Gemini
        const enhancedCaptionResult = await model.generateContent([
            "Describe this photo with the help of this caption.",
            `User's caption: "${caption}"`,
            imagePart
        ]);
        const enhancedCaption = enhancedCaptionResult.response.text();
        console.log("Enhanced Caption:", enhancedCaption);

        // Generate title from enhanced caption
        const titleResult = await model.generateContent(`Generate a single, short, concise title (4-5 words max) for the following journal entry. Do not provide a list of options. Just provide one title. 

"${enhancedCaption}"`);
        const title = titleResult.response.text().replace(/"/g, ''); // Remove quotes from title
        console.log("Generated Title:", title);

        const noteData = {
            id: uuidv4(),
            title: title || 'Untitled Photo',
            transcript: enhancedCaption || caption, // Use enhanced caption as transcript
            type: 'photo',
            date: req.body.localTimestamp || new Date().toISOString(),
            imageUrl: `/images/${userId}/${filename}`,
            originalCaption: caption,
        };

        const newNote = await db.createNote(userId, noteData);
        res.status(201).json(newNote);
    } catch (error) {
        console.error('Error processing photo with AI:', error);
        res.status(500).json({ error: 'Failed to process photo with AI.' });
    }
});

app.delete('/api/notes/:id', requireAuth(), async (req, res) => {
    const { id } = req.params;
    const userId = req.auth.userId;
    
    try {
        // First get the note to find associated files
        const notes = await db.getNotes(userId);
        const noteToDelete = notes.find(n => n.id === id);

        if (!noteToDelete) {
            return res.status(404).json({ error: 'Note not found.' });
        }

        // Delete associated files from Supabase Storage
        if (noteToDelete.audio_url || noteToDelete.audioUrl) {
            const audioUrl = noteToDelete.audio_url || noteToDelete.audioUrl;
            // Extract filename from URL like "/audio/userId/filename.wav"
            const filename = audioUrl.split('/').pop();
            const filePath = `${userId}/${filename}`;
            try {
                await supabase.storage.from('audio').remove([filePath]);
            } catch (err) {
                console.error(`Failed to delete audio file from storage: ${filePath}`, err);
                // Continue even if file deletion fails
            }
        }
        
        if (noteToDelete.image_url || noteToDelete.imageUrl) {
            const imageUrl = noteToDelete.image_url || noteToDelete.imageUrl;
            // Extract filename from URL like "/images/userId/filename.jpg"
            const filename = imageUrl.split('/').pop();
            const filePath = `${userId}/${filename}`;
            try {
                await supabase.storage.from('images').remove([filePath]);
            } catch (err) {
                console.error(`Failed to delete image file from storage: ${filePath}`, err);
                // Continue even if file deletion fails
            }
        }
        
        await db.deleteNote(userId, id);
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting note:', error);
        res.status(500).json({ error: 'Failed to delete note' });
    }
});

// Update note transcript
app.put('/api/notes/:id/transcript', requireAuth(), async (req, res) => {
    const { id } = req.params;
    const { transcript } = req.body;
    const userId = req.auth.userId;
    
    if (!transcript || typeof transcript !== 'string') {
        return res.status(400).json({ error: 'Transcript is required and must be a string' });
    }
    
    try {
        const updatedNote = await db.updateNote(userId, id, { transcript: transcript.trim() });
        res.json(updatedNote);
    } catch (error) {
        console.error('Error updating transcript:', error);
        if (error.message.includes('not found')) {
            res.status(404).json({ error: 'Note not found' });
        } else {
            res.status(500).json({ error: 'Failed to update transcript' });
        }
    }
});


// -- Profile --
app.get('/api/profile', requireAuth(), async (req, res) => {
    try {
        const profile = await db.getProfile(req.auth.userId) || { 
            name: '', 
            values: '', 
            mission: '', 
            profileImageUrl: '' 
        };
        res.json(profile);
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

app.post('/api/profile', requireAuth(), async (req, res) => {
    try {
        const profile = await db.upsertProfile(req.auth.userId, req.body);
        res.status(200).json(profile);
    } catch (error) {
        console.error('Error saving profile:', error);
        res.status(500).json({ error: 'Failed to save profile' });
    }
});

// Profile picture upload endpoint
app.post('/api/profile/image', requireAuth(), uploadProfileImage.single('profileImage'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file uploaded' });
        }

        const userId = req.auth.userId;
        const filename = `profile_${uuidv4()}${path.extname(req.file.originalname)}`;
        const filePath = `${userId}/${filename}`;
        
        // Upload file to Supabase Storage
        await uploadFileToSupabase('images', filePath, req.file.buffer, req.file.mimetype);
        
        // Get current profile
        const currentProfile = await db.getProfile(userId) || { 
            name: '', 
            values: '', 
            mission: '', 
            profileImageUrl: '' 
        };
        
        // Update profile with new image URL
        const imageUrl = `/images/${userId}/${filename}`;
        const updatedProfile = await db.upsertProfile(userId, {
            ...currentProfile,
            profileImageUrl: imageUrl
        });
        
        res.json({ 
            profileImageUrl: imageUrl,
            message: 'Profile picture uploaded successfully' 
        });
    } catch (error) {
        console.error('Error uploading profile picture:', error);
        res.status(500).json({ error: 'Failed to upload profile picture' });
    }
});

// -- Reflection --

// Generate post-reflection summary
app.post('/api/reflect/summary', requireAuth(), async (req, res) => {
    const { noteIds, duration } = req.body;
    
    if (!noteIds || noteIds.length === 0) {
        return res.status(400).json({ error: 'Note IDs are required for summary generation.' });
    }
    
    try {
        const userId = req.auth.userId;
        const allNotes = await db.getNotes(userId);
        const selectedNotes = allNotes.filter(note => noteIds.includes(note.id));
        
        if (selectedNotes.length === 0) {
            return res.status(404).json({ error: 'Selected notes not found.' });
        }
        
        const transcripts = selectedNotes.map(n => n.transcript).join('\n\n---\n\n');
        
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const summaryPrompt = `
You have just completed a ${duration || 5}-minute guided reflection session based on these personal experiences:

---
${transcripts}
---

Please generate a short, concise summary (2-3 sentences) that captures:
1. The main themes or feelings explored during the reflection
2. Key insights or emotional patterns that emerged
3. A gentle acknowledgment of the person's inner journey

The summary should be warm, supportive, and provide closure to the reflection experience. Avoid being overly clinical or analytical - speak with compassion and understanding.
        `;
        
        const result = await model.generateContent(summaryPrompt);
        const summary = result.response.text().trim();
        
        res.json({ 
            summary,
            reflectedOn: selectedNotes.length,
            duration: duration || 5
        });
        
    } catch (error) {
        console.error('Error generating reflection summary:', error);
        res.status(500).json({ error: 'Failed to generate reflection summary.' });
    }
});

// -- Meditation --
app.post('/api/meditate', requireAuth(), async (req, res) => {
    const { noteIds, duration = 5, timeOfReflection = 'Day' } = req.body; // Default to 5 minutes and Day if not specified
    if (!noteIds || noteIds.length === 0) {
        return res.status(400).json({ error: 'Note IDs are required.' });
    }

    try {
        const userId = req.auth.userId;
        const allNotes = await db.getNotes(userId);
        const profile = await db.getProfile(userId) || { name: '', values: '', mission: '', profileImageUrl: '' };

        const selectedNotes = allNotes.filter(note => noteIds.includes(note.id));
        if (selectedNotes.length === 0) {
            return res.status(404).json({ error: 'Selected notes not found.' });
        }
        const transcripts = selectedNotes.map(n => n.transcript).join('\n\n---\n\n');

        // 1. Generate Script with Gemini
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        let masterPrompt;
        
        if (timeOfReflection === 'Night') {
            masterPrompt = `
                You are an experienced meditation practitioner. You are great at taking raw experiences and sensory data and converting them into a ${duration}-minute meditation session. Your role is to provide a focused, reflective space for life's meaningful moments. The guided reflection should be thoughtful and not cloying, with pauses for quiet reflection using the format [PAUSE=Xs], where X is the number of seconds. Do not generate any asterisks, i.e. * around any words or text.

                Guidelines:
                - The user is currently in a nighttime reflection session. So the session should be more reflective and introspective and aimed at consolidating or crystallizing the day's experiences.
                Keep it to exactly ${duration} minutes total
                - Only highlight values that naturally connect to the chosen experiences - don't force all values into every reflection. It's actually ok to not mention any values at all.
                - Include appropriate pauses (feel free to decide the number of seconds to pause)
                - Make sure that the beginning and ending of each session feels natural. For example, during the ending, there should be a language to guide the transition smoothly from the session back into the world. Don't end with a pause.
                - Adjust the depth and pacing based on the session duration: longer sessions should allow for deeper exploration and longer pauses
                
                Here is the user's context:
                - Name: ${profile.name || 'User'}
                - Core Values: ${profile.values || 'Not specified'}
                - Life Mission: ${profile.mission || 'Not specified'}
                
                Here are the user's selected experiences for reflection:
                ---
                ${transcripts}
                ---
                
                Please begin the ${duration}-minute guided meditation script now.
            `;
        } else {
            masterPrompt = `
                You are an experienced meditation practitioner. You are great at taking raw experiences and sensory data and converting them into a ${duration}-minute meditation session. Your role is to provide a focused, reflective space for life's meaningful moments. The guided reflection should be thoughtful and not cloying, with pauses for quiet reflection using the format [PAUSE=Xs], where X is the number of seconds.

                Guidelines:

                - The user is currently in a daytime reflection session. So the session, while taking the experiences, should be more forward-looking and in particular priming the user for the day ahead. It should ground him, remind him of his values, and help him feel connected to his mission so that he is recharged and energized for the day ahead.
                Keep it to exactly ${duration} minutes total
                - Only highlight values that naturally connect to the chosen experiences - don't force all values into every reflection. It's actually ok to not mention any values at all.
                - Include appropriate pauses (feel free to decide the number of seconds to pause)
                - Make sure that the beginning and ending of each session feels natural. For example, during the ending, there should be a language to guide the transition smoothly from the session back into the world. Don't end with a pause.
                - Adjust the depth and pacing based on the session duration: longer sessions should allow for deeper exploration and longer pauses
                
                Here is the user's context:
                - Name: ${profile.name || 'User'}
                - Core Values: ${profile.values || 'Not specified'}
                - Life Mission: ${profile.mission || 'Not specified'}
                
                Here are the user's selected experiences for reflection:
                ---
                ${transcripts}
                ---
                
                Please begin the ${duration}-minute guided meditation script now.
            `;
        }

        const result = await model.generateContent(masterPrompt);
        const script = result.response.text();
        console.log(`Generated ${timeOfReflection} Reflection Script (${duration}min):`, script);

        // 2. Parse script and generate audio with Gemini TTS
        const segments = script.split(/(\[PAUSE=\d+s\])/g).filter(s => s.trim() !== '');
        console.log("Segments for TTS:", segments);

        const playlist = [];
        for (const segment of segments) {
            if (segment.startsWith('[PAUSE=')) {
                const duration = parseInt(segment.match(/\d+/)[0], 10);
                playlist.push({ type: 'pause', duration });
            } else {
                const audioFileName = `meditation_${uuidv4()}.wav`;
                const filePath = `${userId}/${audioFileName}`;
                
                const cleanedSegment = segment.replace(/\n/g, ' ').trim();
                console.log("Cleaned Segment for TTS:", cleanedSegment);

                if (cleanedSegment) {
                    // Generate TTS with Replicate Kokoro
                    const input = {
                        text: cleanedSegment,
                        voice: "af_nicole",
                        speed: 1.0
                    };

                    console.log("Generating TTS with Replicate for segment:", cleanedSegment.substring(0, 50) + "...");
                    
                    const output = await replicate.run(
                        "jaaari/kokoro-82m:f559560eb822dc509045f3921a1921234918b91739db4bf3daab2169b71c7a13",
                        { input }
                    );

                    // Upload TTS audio to Supabase Storage
                    console.log("Uploading meditation audio to Supabase Storage:", filePath);
                    await uploadFileToSupabase('meditations', filePath, output, 'audio/wav');

                    playlist.push({ type: 'speech', audioUrl: `/meditations/${audioFileName}` });
                }
            }
        }

        // Generate summary for this meditation
        const summaryModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
        const summaryPrompt = `
You have just completed a ${duration}-minute guided reflection session based on these personal experiences:
---
${transcripts}
---
Please generate a short, concise summary (2-3 sentences) that captures:
1. The main themes or feelings explored during the reflection
2. Key insights or emotional patterns that emerged
3. A gentle acknowledgment of the person's inner journey
The summary should be warm, supportive, and provide closure to the reflection experience. Avoid being overly clinical or analytical - speak with compassion and understanding.
        `;
        
        const summaryResult = await summaryModel.generateContent(summaryPrompt);
        const summary = summaryResult.response.text().trim();

        // Save the meditation
        const meditationData = {
            id: uuidv4(),
            title: `${duration}-min Reflection - ${new Date().toLocaleDateString()}`,
            createdAt: new Date().toISOString(),
            playlist,
            noteIds,
            script,
            duration,
            summary,
            timeOfReflection
        };

        const savedMeditation = await db.createMeditation(userId, meditationData);

        res.status(200).json({ playlist, meditationId: savedMeditation.id, summary });

    } catch (error) {
        console.error("Meditation generation failed:", error);
        res.status(500).json({ error: "Failed to generate meditation." });
    }
});

// -- Saved Meditations --
app.get('/api/meditations', requireAuth(), async (req, res) => {
    try {
        const meditations = await db.getMeditations(req.auth.userId);
        // Return without the full script to reduce payload size
        const meditationsList = meditations.map(m => ({
            id: m.id,
            title: m.title,
            createdAt: m.created_at || m.createdAt,
            noteIds: m.note_ids || m.noteIds,
            summary: m.summary,
            timeOfReflection: m.time_of_reflection || m.timeOfReflection || 'Day'
        }));
        res.status(200).json(meditationsList);
    } catch (error) {
        console.error('Error fetching meditations:', error);
        res.status(500).json({ error: 'Failed to fetch meditations' });
    }
});

app.get('/api/meditations/:id', requireAuth(), async (req, res) => {
    try {
        const meditation = await db.getMeditation(req.auth.userId, req.params.id);
        if (!meditation) {
            return res.status(404).json({ error: 'Meditation not found.' });
        }
        res.status(200).json(meditation);
    } catch (error) {
        console.error('Error fetching meditation:', error);
        res.status(500).json({ error: 'Failed to fetch meditation' });
    }
});

// Get a pre-saved day reflection meditation
app.get('/api/meditations/day/default', async (req, res) => {
    try {
        const dayAudioPath = path.join(__dirname, 'data', 'day_audio', 'merged_day_meditation.wav');
        
        // Check if the merged day meditation file exists
        if (!fsSync.existsSync(dayAudioPath)) {
            return res.status(404).json({ error: 'Day reflection audio not found' });
        }
        
        // Return a meditation object that points to the merged audio file
        const dayMeditation = {
            id: 'default-day-meditation',
            title: 'Daily Reflection',
            createdAt: new Date().toISOString(),
            timeOfReflection: 'Day',
            duration: 5, // Approximate duration in minutes
            summary: 'A guided daily reflection to ground yourself and prepare for the day ahead.',
            playlist: [
                {
                    type: 'speech',
                    audioUrl: '/day_audio/merged_day_meditation.wav'
                }
            ],
            noteIds: []
        };
        
        res.status(200).json(dayMeditation);
    } catch (err) {
        console.error("Error loading default day meditation:", err);
        res.status(500).json({ error: 'Failed to load day reflection' });
    }
});

app.delete('/api/meditations/:id', requireAuth(), async (req, res) => {
    try {
        const userId = req.auth.userId;
        const meditation = await db.getMeditation(userId, req.params.id);
        
        if (!meditation) {
            return res.status(404).json({ error: 'Meditation not found.' });
        }
        
        // Delete audio files associated with this meditation
        if (meditation.playlist) {
            for (const item of meditation.playlist) {
                if (item.type === 'speech' && item.audioUrl) {
                    const audioFile = path.join(__dirname, 'data', item.audioUrl.replace(/^\//, ''));
                    try {
                        await fs.unlink(audioFile);
                    } catch (err) {
                        console.log(`Could not delete audio file: ${audioFile}`);
                    }
                }
            }
        }
        
        await db.deleteMeditation(userId, req.params.id);
        res.status(200).json({ message: 'Meditation deleted successfully.' });
    } catch (error) {
        console.error('Error deleting meditation:', error);
        res.status(500).json({ error: 'Failed to delete meditation' });
    }
});

// -- Stats Endpoints --
app.get('/api/stats/streak', requireAuth(), async (req, res) => {
    try {
        const meditations = await db.getMeditations(req.auth.userId);
        
        // Calculate current streak by checking consecutive days with meditations
        const today = new Date();
        let streak = 0;
        let checkDate = new Date(today);
        
        // Start from today and work backwards
        while (true) {
            const dateString = checkDate.toISOString().split('T')[0];
            const hasMeditation = meditations.some(m => {
                const meditationDate = new Date(m.created_at || m.createdAt).toISOString().split('T')[0];
                return meditationDate === dateString;
            });
            
            if (hasMeditation) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
        }
        
        res.status(200).json({ streak });
    } catch (error) {
        console.error('Error calculating streak:', error);
        res.status(500).json({ error: 'Failed to calculate streak' });
    }
});

app.get('/api/stats/monthly', requireAuth(), async (req, res) => {
    try {
        const meditations = await db.getMeditations(req.auth.userId);
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        
        const thisMonthCount = meditations.filter(m => {
            const meditationDate = new Date(m.created_at || m.createdAt);
            return meditationDate.getMonth() === currentMonth && 
                   meditationDate.getFullYear() === currentYear;
        }).length;
        
        res.status(200).json({ count: thisMonthCount });
    } catch (error) {
        console.error('Error calculating monthly stats:', error);
        res.status(500).json({ error: 'Failed to calculate monthly stats' });
    }
});

app.get('/api/stats/calendar', requireAuth(), async (req, res) => {
    try {
        const meditations = await db.getMeditations(req.auth.userId);
        
        // Get all unique dates when meditations were created
        const reflectionDates = meditations.map(m => {
            return new Date(m.created_at || m.createdAt).toISOString().split('T')[0];
        });
        
        // Remove duplicates
        const uniqueDates = [...new Set(reflectionDates)];
        
        res.status(200).json({ dates: uniqueDates });
    } catch (error) {
        console.error('Error getting calendar data:', error);
        res.status(500).json({ error: 'Failed to get calendar data' });
    }
});

// Catch-all handler: send back React's index.html file for client-side routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});

