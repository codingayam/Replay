

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs/promises');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const wav = require('wav');

const app = express();
const port = process.env.PORT || 3001;

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// Serve static files from React build
app.use(express.static(path.join(__dirname, '../client/dist')));

app.use('/audio', express.static(path.join(__dirname, 'data/audio')));
app.use('/images', express.static(path.join(__dirname, 'data/images')));

// --- FILE STORAGE SETUP ---
const NOTES_FILE = path.join(__dirname, 'data/notes.json');
const PROFILE_FILE = path.join(__dirname, 'data/profile.json');
const MEDITATIONS_FILE = path.join(__dirname, 'data/meditations.json');
const audioUploadPath = path.join(__dirname, 'data/audio');
const imageUploadPath = path.join(__dirname, 'data/images');

// Audio upload storage
const audioStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, audioUploadPath),
    filename: (req, file, cb) => cb(null, `${uuidv4()}.wav`),
});
const uploadAudio = multer({ storage: audioStorage });

// Image upload storage
const imageStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, imageUploadPath),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${uuidv4()}${ext}`);
    },
});
const uploadImage = multer({ 
    storage: imageStorage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    },
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Profile picture upload storage (same as images but for profiles)
const uploadProfileImage = multer({ 
    storage: imageStorage,
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
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

// --- API ROUTES ---

// -- Notes --
app.get('/api/notes', async (req, res) => {
    // Provide a default empty array if the file is empty or doesn't exist.
    const notes = await readData(NOTES_FILE) || [];
    res.json(notes.sort((a, b) => new Date(b.date) - new Date(a.date)));
});

// Get notes within a date range
app.get('/api/notes/date-range', async (req, res) => {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
        return res.status(400).send('Both startDate and endDate are required.');
    }
    
    try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        // Set end date to end of day
        end.setHours(23, 59, 59, 999);
        
        const allNotes = await readData(NOTES_FILE) || [];
        const filteredNotes = allNotes.filter(note => {
            const noteDate = new Date(note.date);
            return noteDate >= start && noteDate <= end;
        });
        
        res.json(filteredNotes.sort((a, b) => new Date(b.date) - new Date(a.date)));
    } catch (error) {
        console.error('Error filtering notes by date range:', error);
        res.status(400).send('Invalid date format. Use ISO format (YYYY-MM-DD).');
    }
});

app.post('/api/notes', uploadAudio.single('audio'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('Audio file is required.');
    }
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const audioFilePath = req.file.path;
        // 1. Generate Transcript
        const audioBytes = await fs.readFile(audioFilePath);
        const audioBase64 = audioBytes.toString('base64');
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

        const newNote = {
            id: uuidv4(),
            title: parsedResponse.title || 'Untitled Note',
            transcript: parsedResponse.transcript || 'No transcript available.',
            category: parsedResponse.category || 'experience',
            type: 'audio',
            date: req.body.localTimestamp || new Date().toISOString(),
            duration: 0, // Placeholder, can be implemented with an audio library
            audioUrl: `/audio/${req.file.filename}`,
        };
        const notes = await readData(NOTES_FILE) || [];
        notes.push(newNote);
        await writeData(NOTES_FILE, notes);
        res.status(201).json(newNote);
    } catch (error) {
        console.error('Error processing note with AI:', error);
        res.status(500).send('Failed to process note with AI.');
    }
});;

// Photo upload endpoint
app.post('/api/notes/photo', uploadImage.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('Image file is required.');
    }
    
    const { caption } = req.body;
    if (!caption || !caption.trim()) {
        return res.status(400).send('Caption is required.');
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
        const imageFilePath = req.file.path;
        
        // Read and encode the image
        const imageBytes = await fs.readFile(imageFilePath);
        const imageBase64 = imageBytes.toString('base64');
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

        const newNote = {
            id: uuidv4(),
            title: title || 'Untitled Photo',
            transcript: enhancedCaption || caption, // Use enhanced caption as transcript
            type: 'photo',
            date: req.body.localTimestamp || new Date().toISOString(),
            imageUrl: `/images/${req.file.filename}`,
            originalCaption: caption,
        };

        const notes = await readData(NOTES_FILE) || [];
        notes.push(newNote);
        await writeData(NOTES_FILE, notes);
        res.status(201).json(newNote);
    } catch (error) {
        console.error('Error processing photo with AI:', error);
        res.status(500).send('Failed to process photo with AI.');
    }
});

app.delete('/api/notes/:id', async (req, res) => {
    const { id } = req.params;
    let notes = await readData(NOTES_FILE);
    const noteToDelete = notes.find(n => n.id === id);

    if (!noteToDelete) {
        return res.status(404).send('Note not found.');
    }

    // Delete associated files (audio or image)
    if (noteToDelete.audioUrl) {
        const audioFilePath = path.join(__dirname, 'data', noteToDelete.audioUrl);
        try {
            await fs.unlink(audioFilePath);
        } catch (err) {
            console.error(`Failed to delete audio file: ${audioFilePath}`, err);
            // Continue even if file deletion fails
        }
    }
    
    if (noteToDelete.imageUrl) {
        const imageFilePath = path.join(__dirname, 'data', noteToDelete.imageUrl);
        try {
            await fs.unlink(imageFilePath);
        } catch (err) {
            console.error(`Failed to delete image file: ${imageFilePath}`, err);
            // Continue even if file deletion fails
        }
    }
    
    const updatedNotes = notes.filter(n => n.id !== id);
    await writeData(NOTES_FILE, updatedNotes);
    res.status(204).send();
});

// Update note transcript
app.put('/api/notes/:id/transcript', async (req, res) => {
    const { id } = req.params;
    const { transcript } = req.body;
    
    if (!transcript || typeof transcript !== 'string') {
        return res.status(400).json({ error: 'Transcript is required and must be a string' });
    }
    
    let notes = await readData(NOTES_FILE);
    const noteIndex = notes.findIndex(n => n.id === id);
    
    if (noteIndex === -1) {
        return res.status(404).json({ error: 'Note not found' });
    }
    
    // Update the transcript
    notes[noteIndex].transcript = transcript.trim();
    
    await writeData(NOTES_FILE, notes);
    res.json(notes[noteIndex]);
});


// -- Profile --
app.get('/api/profile', async (req, res) => {
    const profile = await readData(PROFILE_FILE) || { name: '', values: '', mission: '', profileImageUrl: '' };
    res.json(profile);
});

app.post('/api/profile', async (req, res) => {
    await writeData(PROFILE_FILE, req.body);
    res.status(200).json(req.body);
});

// Profile picture upload endpoint
app.post('/api/profile/image', uploadProfileImage.single('profileImage'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file uploaded' });
        }

        // Get current profile
        const profile = await readData(PROFILE_FILE) || { name: '', values: '', mission: '', profileImageUrl: '' };
        
        // Update profile with new image URL
        const imageUrl = `/images/${req.file.filename}`;
        profile.profileImageUrl = imageUrl;
        
        // Save updated profile
        await writeData(PROFILE_FILE, profile);
        
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
// AI-powered experience suggestion endpoint
app.post('/api/reflect/suggest', async (req, res) => {
    const { startDate, endDate, duration } = req.body;
    
    if (!startDate || !endDate || !duration) {
        return res.status(400).send('startDate, endDate, and duration are required.');
    }
    
    try {
        // Get notes in date range
        const allNotes = await readData(NOTES_FILE) || [];
        
        // Filter notes by local date range (notes now contain local timestamps)
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // Set to end of day
        
        const notesInRange = allNotes.filter(note => {
            const noteDate = new Date(note.date);
            return noteDate >= start && noteDate <= end;
        });
        
        if (notesInRange.length === 0) {
            return res.json({ suggestedNotes: [], availableNotes: [] });
        }
        
        // Calculate optimal number of notes based on duration
        const baseNotesCount = Math.max(1, Math.floor(duration / 5)); // 1 note per 5 minutes, minimum 1
        const maxNotes = Math.min(baseNotesCount + 2, notesInRange.length); // Allow slight flexibility
        const targetNotes = Math.min(maxNotes, notesInRange.length);
        
        // Use AI to select the most thoughtful experiences
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const notesForAI = notesInRange.map(note => ({
            id: note.id,
            title: note.title,
            transcript: note.transcript,
            date: note.date
        }));
        
        const selectionPrompt = `
You are an AI assistant helping to curate meaningful experiences for a ${duration}-minute guided reflection session.

From the following ${notesInRange.length} experiences, please select the ${targetNotes} most thoughtful, emotionally rich, and reflection-worthy entries. Consider:
1. Depth of emotion and meaning
2. Potential for personal growth insights  
3. Variety in themes and experiences
4. Quality of content for meditation reflection

Experiences:
${notesForAI.map((note, idx) => `${idx + 1}. ID: ${note.id}
Title: ${note.title}
Date: ${new Date(note.date).toLocaleDateString()}
Content: ${note.transcript}
---`).join('\n')}

Please respond with only a JSON array of the selected note IDs, like: ["id1", "id2", "id3"]
Select exactly ${targetNotes} note(s).
        `;
        
        const result = await model.generateContent(selectionPrompt);
        const responseText = result.response.text().trim();
        
        let suggestedNoteIds;
        try {
            // Extract JSON from response
            const jsonMatch = responseText.match(/\[.*\]/);
            if (jsonMatch) {
                suggestedNoteIds = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No JSON array found in response');
            }
        } catch (parseError) {
            console.error('Failed to parse AI response:', responseText);
            // Fallback: select most recent notes
            suggestedNoteIds = notesInRange
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, targetNotes)
                .map(note => note.id);
        }
        
        // Filter valid suggestions
        const validSuggestions = suggestedNoteIds.filter(id => 
            notesInRange.some(note => note.id === id)
        );
        
        const suggestedNotes = validSuggestions.map(id => 
            notesInRange.find(note => note.id === id)
        ).filter(Boolean);
        
        res.json({
            suggestedNotes,
            availableNotes: notesInRange,
            recommendedCount: targetNotes,
            duration
        });
        
    } catch (error) {
        console.error('Error generating reflection suggestions:', error);
        res.status(500).send('Failed to generate reflection suggestions.');
    }
});

// Generate post-reflection summary
app.post('/api/reflect/summary', async (req, res) => {
    const { noteIds, duration } = req.body;
    
    if (!noteIds || noteIds.length === 0) {
        return res.status(400).send('Note IDs are required for summary generation.');
    }
    
    try {
        const allNotes = await readData(NOTES_FILE) || [];
        const selectedNotes = allNotes.filter(note => noteIds.includes(note.id));
        
        if (selectedNotes.length === 0) {
            return res.status(404).send('Selected notes not found.');
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
        res.status(500).send('Failed to generate reflection summary.');
    }
});

// -- Meditation --
app.post('/api/meditate', async (req, res) => {
    const { noteIds, duration = 5 } = req.body; // Default to 5 minutes if not specified
    if (!noteIds || noteIds.length === 0) {
        return res.status(400).send('Note IDs are required.');
    }

    try {
        const allNotes = await readData(NOTES_FILE) || [];
        const profile = await readData(PROFILE_FILE) || { name: '', values: '', mission: '', profileImageUrl: '' };

        const selectedNotes = allNotes.filter(note => noteIds.includes(note.id));
        if (selectedNotes.length === 0) {
            return res.status(404).send('Selected notes not found.');
        }
        const transcripts = selectedNotes.map(n => n.transcript).join('\n\n---\n\n');

        // 1. Generate Script with Gemini
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const masterPrompt = `
            You are an experienced meditation practitioner. You are great at taking raw experiences and sensory data and converting them into a ${duration}-minute meditation session. Your role is to provide a focused, reflective space for life's meaningful moments. The guided reflection should be thoughtful and not cloying, with pauses for quiet reflection using the format [PAUSE=Xs], where X is the number of seconds.

            Guidelines:

            - Keep it to exactly ${duration} minutes total
            - Only highlight values that naturally connect to the chosen experiences - don't force all values into every reflection. It's actually ok to not mention any values at all.
            - Include appropriate pauses (feel free to decide the number of seconds to pause)
            - Make sure that the beginning and ending of each session feels natural. For example, during the ending, there should be a language to guide the transition smoothly from the session back into the world. There should not be any pauses after the ending words.
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

        const result = await model.generateContent(masterPrompt);
        const script = result.response.text();
        console.log("Generated Script:", script);

        // 2. Parse script and generate audio with Gemini TTS
        const segments = script.split(/(\[PAUSE=\d+s\])/g).filter(s => s.trim() !== '');
        console.log("Segments for TTS:", segments);

        const playlist = [];
        for (const segment of segments) {
            if (segment.startsWith('[PAUSE=')) {
                const duration = parseInt(segment.match(/\d+/)[0], 10);
                playlist.push({ type: 'pause', duration });
            } else {
                const audioFileName = `${uuidv4()}.wav`;
                const audioFilePath = path.join(audioUploadPath, audioFileName);
                
                const cleanedSegment = segment.replace(/\n/g, ' ').trim();
                console.log("Cleaned Segment for TTS:", cleanedSegment);

                if (cleanedSegment) {
                    // Generate TTS with OpenAI
                    const response = await openai.audio.speech.create({
                        model: "gpt-4o-mini-tts",
                        voice: "fable", // Calm, soothing voice suitable for meditation
                        input: cleanedSegment,
                        response_format: "wav",
                        speed: 1.0, // Normal pace
                        instructions: "Speak in a warm, gentle tone that feels safe and inviting. Maintain a slow, steady pace, allowing your words to flow smoothly without rushing. Use natural pauses and short silences to give space for reflection, and let your breath be calm and even so it supports your voice. Enunciate clearly, but keep your articulation soft, never sharp. Keep your volume low but audible, so it feels close and personal without straining the listener."
                    });

                    const audioBuffer = Buffer.from(await response.arrayBuffer());
                    
                    // Save as WAV file
                    await fs.writeFile(audioFilePath, audioBuffer);

                    playlist.push({ type: 'speech', audioUrl: `/audio/${audioFileName}` });
                }
            }
        }

        // Generate summary for this meditation
        const summaryModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
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
        const meditationId = uuidv4();
        const meditation = {
            id: meditationId,
            title: `${duration}-min Reflection - ${new Date().toLocaleDateString()}`,
            createdAt: new Date().toISOString(),
            playlist,
            noteIds,
            script,
            duration,
            summary
        };

        const meditations = await readData(MEDITATIONS_FILE) || [];
        meditations.push(meditation);
        await writeData(MEDITATIONS_FILE, meditations);

        res.status(200).json({ playlist, meditationId, summary });

    } catch (error) {
        console.error("Meditation generation failed:", error);
        res.status(500).send("Failed to generate meditation.");
    }
});

// -- Saved Meditations --
app.get('/api/meditations', async (req, res) => {
    const meditations = await readData(MEDITATIONS_FILE) || [];
    // Return without the full script to reduce payload size
    const meditationsList = meditations.map(m => ({
        id: m.id,
        title: m.title,
        createdAt: m.createdAt,
        noteIds: m.noteIds,
        summary: m.summary
    }));
    res.status(200).json(meditationsList);
});

app.get('/api/meditations/:id', async (req, res) => {
    const meditations = await readData(MEDITATIONS_FILE) || [];
    const meditation = meditations.find(m => m.id === req.params.id);
    if (!meditation) {
        return res.status(404).send('Meditation not found.');
    }
    res.status(200).json(meditation);
});

app.delete('/api/meditations/:id', async (req, res) => {
    const meditations = await readData(MEDITATIONS_FILE) || [];
    const index = meditations.findIndex(m => m.id === req.params.id);
    if (index === -1) {
        return res.status(404).send('Meditation not found.');
    }
    
    // Delete audio files associated with this meditation
    const meditation = meditations[index];
    if (meditation.playlist) {
        for (const item of meditation.playlist) {
            if (item.type === 'speech' && item.audioUrl) {
                const audioFile = path.join(__dirname, 'data', item.audioUrl);
                try {
                    await fs.unlink(audioFile);
                } catch (err) {
                    console.log(`Could not delete audio file: ${audioFile}`);
                }
            }
        }
    }
    
    meditations.splice(index, 1);
    await writeData(MEDITATIONS_FILE, meditations);
    res.status(200).json({ message: 'Meditation deleted successfully.' });
});

// Catch-all handler: send back React's index.html file for client-side routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});

