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
        console.log('🎵 Processing audio upload...');
        
        let audioData;
        try {
          // Handle audio upload using busboy
          audioData = await parseMultipartForm(req);
          
          console.log('✅ Parsed audio data successfully:', {
            hasAudioBuffer: !!audioData.audioBuffer,
            audioBufferSize: audioData.audioBuffer?.length,
            fields: Object.keys(audioData)
          });
        } catch (parseError) {
          console.error('❌ STEP 1 ERROR - Form parsing failed:', parseError);
          throw new Error(`Form parsing failed: ${parseError.message}`);
        }
        
        if (!audioData.audioBuffer) {
          console.error('No audio buffer found in form data');
          return res.status(400).json({ error: 'No audio file provided' });
        }

        const audioFileName = `${uuidv4()}.wav`;
        const audioPath = `${user.id}/${audioFileName}`;

        console.log('📁 STEP 2: Uploading to Supabase Storage:', { audioPath, audioFileName });

        let uploadData;
        try {
          // Upload to Supabase Storage
          const uploadResult = await supabase.storage
            .from('audio')
            .upload(audioPath, audioData.audioBuffer, {
              contentType: 'audio/wav',
            });

          if (uploadResult.error) {
            console.error('❌ STEP 2 ERROR - Supabase storage upload error:', uploadResult.error);
            throw new Error(`Storage upload failed: ${uploadResult.error.message}`);
          }

          uploadData = uploadResult.data;
          console.log('✅ STEP 2 SUCCESS - Upload successful:', uploadData);
        } catch (storageError) {
          console.error('❌ STEP 2 FATAL ERROR - Storage operation failed:', storageError);
          throw new Error(`Storage operation failed: ${storageError.message}`);
        }

        // Convert audio buffer to base64 for Gemini API
        console.log('🤖 STEP 3: Preparing for Gemini API...');
        const base64Audio = audioData.audioBuffer.toString('base64');
        console.log('✅ Prepared base64 audio for Gemini, length:', base64Audio.length);

        let transcript, title, category;
        try {
          // Get transcription using Gemini
          const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
          
          console.log('🔮 STEP 3A: Requesting transcription from Gemini...');
          const transcriptionResult = await model.generateContent([
            {
              inlineData: {
                mimeType: 'audio/wav',
                data: base64Audio
              }
            },
            'Please transcribe this audio recording accurately. Only return the transcribed text, no additional commentary.'
          ]);

          transcript = transcriptionResult.response.text().trim();
          console.log('✅ STEP 3A SUCCESS - Transcription received:', transcript.substring(0, 100) + '...');

          // Generate title from transcript
          console.log('🏷️ STEP 3B: Generating title from transcript...');
          const titleResult = await model.generateContent([
            `Based on this journal entry transcript, generate a concise, meaningful title (maximum 8 words): "${transcript}"`
          ]);

          title = titleResult.response.text().trim().replace(/['"]/g, '');
          console.log('✅ STEP 3B SUCCESS - Title generated:', title);

          // Determine category based on content
          console.log('🗂️ STEP 3C: Determining category...');
          const categoryResult = await model.generateContent([
            `Analyze this journal entry and categorize it as one of: gratitude, experience, reflection, or insight. Only return the category name: "${transcript}"`
          ]);

          category = categoryResult.response.text().trim().toLowerCase();
          console.log('✅ STEP 3C SUCCESS - Category determined:', category);
          
        } catch (geminiError) {
          console.error('❌ STEP 3 ERROR - Gemini API failed:', geminiError);
          throw new Error(`Gemini AI processing failed: ${geminiError.message}`);
        }

        // Create note record
        console.log('💾 STEP 4: Preparing database insertion...');
        const noteData = {
          id: uuidv4(), // Explicitly generate ID to fix "null value in column id" error
          user_id: user.id, // This should already be UUID from Supabase auth
          title: title || 'Untitled Audio Note', // Ensure title is never empty
          transcript: transcript || 'No transcript available', // Ensure transcript is never empty
          category: ['gratitude', 'experience', 'reflection', 'insight'].includes(category) ? category : 'experience',
          type: 'audio',
          audio_url: audioPath ? `/audio/${audioPath}` : null,
          duration: audioData.duration ? parseInt(audioData.duration) : null,
          date: new Date().toISOString(), // Always use server time in correct ISO format
        };

        console.log('📝 Note data prepared:', noteData);

        let note;
        try {
          console.log('🗄️ STEP 4: Inserting into database...');
          console.log('📊 Detailed note data being inserted:', JSON.stringify(noteData, null, 2));
          
          const insertResult = await supabase
            .from('notes')
            .insert([noteData])
            .select()
            .single();

          if (insertResult.error) {
            console.error('❌ STEP 4 ERROR - Database insertion error details:', {
              error: insertResult.error,
              code: insertResult.error.code,
              message: insertResult.error.message,
              details: insertResult.error.details,
              hint: insertResult.error.hint
            });
            throw new Error(`Database insert failed: ${insertResult.error.message} (Code: ${insertResult.error.code})`);
          }

          note = insertResult.data;
          console.log('✅ STEP 4 SUCCESS - Note created successfully:', note);
        } catch (dbError) {
          console.error('❌ STEP 4 FATAL ERROR - Database operation failed:', dbError);
          console.error('🔍 Error analysis:', {
            name: dbError.name,
            message: dbError.message,
            cause: dbError.cause,
            stack: dbError.stack
          });
          throw new Error(`Database operation failed: ${dbError.message}`);
        }

        console.log('🎉 AUDIO NOTE CREATION COMPLETE - Returning response');
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
    console.error('❌ NOTES API FATAL ERROR:', error);
    console.error('📍 Error location: API endpoint main try/catch');
    console.error('📋 Error stack:', error.stack);
    console.error('🔍 Error details:', {
      message: error.message,
      name: error.name,
      code: error.code,
      statusCode: error.statusCode,
      cause: error.cause,
      originalError: error.originalError?.message
    });
    
    // Log additional context for debugging
    console.error('🌐 Request context:', {
      method: req.method,
      contentType: req.headers['content-type'],
      hasAuth: !!req.headers.authorization,
      url: req.url
    });
    
    if (error.message === 'No authorization token' || error.message === 'Invalid token' || error.message === 'Authentication failed') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // More detailed error response for debugging
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message,
      type: error.name || 'Unknown',
      timestamp: new Date().toISOString(),
      step: 'main_handler',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

export { config };