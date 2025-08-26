// Vercel serverless function for photo notes
import { verifyAuth, supabase } from '../_middleware.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { v4 as uuidv4 } from 'uuid';
import busboy from 'busboy';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Helper function to parse multipart form data for images
function parseImageForm(req) {
  return new Promise((resolve, reject) => {
    const bb = busboy({ headers: req.headers });
    const fields = {};
    let imageBuffer = null;
    let mimetype = null;

    bb.on('file', (name, file, info) => {
      if (name === 'image') {
        mimetype = info.mimeType;
        const chunks = [];
        file.on('data', (data) => chunks.push(data));
        file.on('end', () => {
          imageBuffer = Buffer.concat(chunks);
        });
      } else {
        file.resume();
      }
    });

    bb.on('field', (name, val) => {
      fields[name] = val;
    });

    bb.on('finish', () => {
      resolve({
        imageBuffer,
        mimetype,
        ...fields
      });
    });

    bb.on('error', (err) => {
      reject(err);
    });

    req.pipe(bb);
  });
}

export default async function handler(req, res) {
  try {
    // Verify authentication
    const user = await verifyAuth(req);

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Handle multipart form data with busboy
    const imageData = await parseImageForm(req);

    if (!imageData.imageBuffer) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const { caption: originalCaption = '' } = imageData;
    const imageBuffer = imageData.imageBuffer;
    const fileName = `${uuidv4()}-${Date.now()}.${imageData.mimetype.split('/')[1]}`;
    const filePath = `${user.id}/${fileName}`;

    // Upload image to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('images')
      .upload(filePath, imageBuffer, {
        contentType: imageData.mimetype,
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Error uploading image:', uploadError);
      return res.status(500).json({ error: 'Failed to upload image' });
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('images')
      .getPublicUrl(filePath);

    const imageUrl = urlData.publicUrl;

    // Generate enhanced description using Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const enhancedPrompt = `Analyze this image and create a detailed, insightful description that captures both the visual elements and the emotional or experiential significance. The user provided this caption: "${originalCaption}". 

Enhance and expand on their caption while maintaining their intent. Focus on:
1. Key visual elements and composition
2. Mood, atmosphere, and emotional tone  
3. Context or story the image might represent
4. Sensory details that could be inferred

Keep the description engaging and personal, as if writing in a journal entry. Limit to 2-3 sentences.`;

    const imageDataForAI = {
      inlineData: {
        data: imageBuffer.toString('base64'),
        mimeType: imageData.mimetype
      }
    };

    const enhancedResult = await model.generateContent([enhancedPrompt, imageDataForAI]);
    const enhancedDescription = enhancedResult.response.text();

    // Generate title using the enhanced description
    const titlePrompt = `Based on this photo description, create a short, memorable title (3-6 words max) that captures the essence of the moment or experience:

Description: "${enhancedDescription}"

Title should be:
- Concise and evocative
- Suitable for a personal journal entry
- Capture the main theme or emotion

Just return the title, nothing else.`;

    const titleResult = await model.generateContent(titlePrompt);
    let title = titleResult.response.text().trim();
    
    // Clean up title (remove quotes if present)
    title = title.replace(/^["']|["']$/g, '');

    // Save to database
    const noteData = {
      id: uuidv4(), // Explicitly generate ID for consistency
      user_id: user.id,
      title,
      transcript: enhancedDescription,
      type: 'photo',
      image_url: imageUrl,
      original_caption: originalCaption,
      date: new Date().toISOString()
    };

    const { data: note, error: dbError } = await supabase
      .from('notes')
      .insert([noteData])
      .select()
      .single();

    if (dbError) {
      console.error('Error saving photo note:', dbError);
      return res.status(500).json({ error: 'Failed to save note' });
    }

    return res.status(201).json(note);

  } catch (error) {
    console.error('Photo notes API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Disable body parser for multipart form data
export const config = {
  api: {
    bodyParser: false,
  },
};