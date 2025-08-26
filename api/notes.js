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
    console.log('Notes API called:', req.method, req.headers['content-type']);
    console.log('Environment check:', {
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    });
    
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
        console.log('Processing audio upload...');
        
        // Handle audio upload using busboy
        const audioData = await parseMultipartForm(req);
        
        console.log('Parsed audio data:', {
          hasAudioBuffer: !!audioData.audioBuffer,
          audioBufferSize: audioData.audioBuffer?.length,
          fields: Object.keys(audioData)
        });
        
        if (!audioData.audioBuffer) {
          console.error('No audio buffer found in form data');
          return res.status(400).json({ error: 'No audio file provided' });
        }

        const audioFileName = `${uuidv4()}.wav`;
        const audioPath = `${user.id}/${audioFileName}`;

        console.log('Uploading to Supabase Storage:', { audioPath, audioFileName });

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('audio')
          .upload(audioPath, audioData.audioBuffer, {
            contentType: 'audio/wav',
          });

        if (uploadError) {
          console.error('Supabase storage upload error:', uploadError);
          throw new Error(`Storage upload failed: ${uploadError.message}`);
        }

        console.log('Upload successful:', uploadData);

        // Convert audio buffer to base64 for Gemini API
        const base64Audio = audioData.audioBuffer.toString('base64');
        console.log('Prepared base64 audio for Gemini, length:', base64Audio.length);

        // Get transcription using Gemini
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        
        console.log('Requesting transcription from Gemini...');
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
        console.log('Transcription received:', transcript.substring(0, 100) + '...');

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

        console.log('Inserting note data:', noteData);

        const { data: note, error } = await supabase
          .from('notes')
          .insert([noteData])
          .select()
          .single();

        if (error) {
          console.error('Database insertion error:', error);
          throw new Error(`Database insert failed: ${error.message}`);
        }

        console.log('Note created successfully:', note);
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
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code,
      statusCode: error.statusCode
    });
    
    if (error.message === 'No authorization token' || error.message === 'Invalid token' || error.message === 'Authentication failed') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // More detailed error response for debugging
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message,
      type: error.name || 'Unknown',
      timestamp: new Date().toISOString()
    });
  }
};

export { config };