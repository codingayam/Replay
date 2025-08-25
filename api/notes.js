// Vercel serverless function for notes API
import { verifyAuth, supabase } from './_middleware.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { v4 as uuidv4 } from 'uuid';
import busboy from 'busboy';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Helper function to parse multipart form data using busboy
function parseMultipartForm(req) {
  return new Promise((resolve, reject) => {
    const bb = busboy({ headers: req.headers });
    const fields = {};
    let audioBuffer = null;

    bb.on('file', (name, file, info) => {
      if (name === 'audio') {
        const chunks = [];
        file.on('data', (data) => chunks.push(data));
        file.on('end', () => {
          audioBuffer = Buffer.concat(chunks);
        });
      } else {
        file.resume(); // Skip other files
      }
    });

    bb.on('field', (name, val) => {
      fields[name] = val;
    });

    bb.on('finish', () => {
      resolve({
        audioBuffer,
        ...fields
      });
    });

    bb.on('error', (err) => {
      reject(err);
    });

    req.pipe(bb);
  });
}

const config = {
  api: {
    bodyParser: false, // Disable body parser for multipart/form-data
  },
};

export default async function handler(req, res) {
  try {
    // Verify authentication
    const user = await verifyAuth(req);

    if (req.method === 'GET') {
      // Get user's notes
      const { data: notes, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (error) {
        throw error;
      }

      return res.status(200).json(notes);
    }

    if (req.method === 'POST') {
      // Check if this is a multipart form (audio upload)
      if (req.headers['content-type']?.includes('multipart/form-data')) {
        // Handle audio upload using busboy
        const audioData = await parseMultipartForm(req);
        
        if (!audioData.audioBuffer) {
          return res.status(400).json({ error: 'No audio file provided' });
        }

        const audioFileName = `${uuidv4()}.wav`;
        const audioPath = `${user.id}/${audioFileName}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('audio')
          .upload(audioPath, audioData.audioBuffer, {
            contentType: 'audio/wav',
          });

        if (uploadError) {
          throw uploadError;
        }

        // Convert audio buffer to base64 for Gemini API
        const base64Audio = audioData.audioBuffer.toString('base64');

        // Get transcription using Gemini
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        
        const transcriptionResult = await model.generateContent([
          {
            inlineData: {
              mimeType: 'audio/wav',
              data: base64Audio
            }
          },
          'Please transcribe this audio recording accurately. Only return the transcribed text, no additional commentary.'
        ]);

        const transcript = transcriptionResult.response.text().trim();

        // Generate title from transcript
        const titleResult = await model.generateContent([
          `Based on this journal entry transcript, generate a concise, meaningful title (maximum 8 words): "${transcript}"`
        ]);

        const title = titleResult.response.text().trim().replace(/['"]/g, '');

        // Determine category based on content
        const categoryResult = await model.generateContent([
          `Analyze this journal entry and categorize it as one of: gratitude, experience, reflection, or insight. Only return the category name: "${transcript}"`
        ]);

        const category = categoryResult.response.text().trim().toLowerCase();

        // Create note record
        const noteData = {
          user_id: user.id,
          title,
          transcript,
          category: ['gratitude', 'experience', 'reflection', 'insight'].includes(category) ? category : 'experience',
          type: 'audio',
          audio_url: `/audio/${audioPath}`,
          duration: audioData.duration || null,
          date: audioData.localTimestamp || new Date().toISOString(),
        };

        const { data: note, error } = await supabase
          .from('notes')
          .insert([noteData])
          .select()
          .single();

        if (error) {
          throw error;
        }

        return res.status(201).json(note);

      } else {
        // Handle regular JSON note creation
        const noteData = {
          ...req.body,
          user_id: user.id,
          date: req.body.date || new Date().toISOString()
        };

        const { data: note, error } = await supabase
          .from('notes')
          .insert([noteData])
          .select()
          .single();

        if (error) {
          throw error;
        }

        return res.status(201).json(note);
      }
    }

    // Method not allowed
    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Notes API error:', error);
    if (error.message === 'No authorization token' || error.message === 'Invalid token' || error.message === 'Authentication failed') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

export { config };