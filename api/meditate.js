// Vercel serverless function for generating meditations
import { verifyAuth, supabase } from './_middleware.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Replicate from 'replicate';
import { v4 as uuidv4 } from 'uuid';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export default async function handler(req, res) {
  try {
    // Verify authentication
    const user = await verifyAuth(req);

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { noteIds, summary, duration = 300 } = req.body;

    if (!noteIds || !Array.isArray(noteIds) || noteIds.length === 0) {
      return res.status(400).json({ error: 'Note IDs are required' });
    }

    // Get the selected notes
    const { data: notes, error: notesError } = await supabase
      .from('notes')
      .select('*')
      .in('id', noteIds)
      .eq('user_id', user.id);

    if (notesError || !notes) {
      return res.status(400).json({ error: 'Failed to fetch notes' });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Generate meditation script using Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const meditationPrompt = `Create a guided meditation script for a ${duration/60}-minute session based on these personal reflections.

User Profile:
${profile ? `
Name: ${profile.name || 'friend'}
Values: ${profile.values || 'personal growth and mindfulness'}
Personal Mission: ${profile.mission || 'living authentically'}
` : ''}

Reflection Summary: ${summary}

Journal Entries:
${notes.map(note => `
Title: ${note.title}
Content: ${note.transcript}
Date: ${new Date(note.date).toLocaleDateString()}
`).join('\n')}

Create a meditation script that:
1. Begins with a gentle welcome and breathing exercise (1-2 minutes)
2. Guides reflection on the key themes from their journal entries
3. Incorporates their personal values and mission
4. Includes mindful pauses for contemplation
5. Ends with intention setting and gratitude (1-2 minutes)

Format as a natural, conversational script. Use "you" to address the listener directly. Include [PAUSE 30s] markers for silence. Keep the tone warm, supportive, and personally relevant.

Total duration should be approximately ${duration/60} minutes.`;

    const scriptResult = await model.generateContent(meditationPrompt);
    const script = scriptResult.response.text();

    // Generate audio using Replicate TTS
    const ttsResponse = await replicate.run(
      "lucataco/tortoise-tts:e9658de4b325863c4fcdc12d94bb7c9b54cbfe351b7ca1b36860008172b91c71",
      {
        input: {
          text: script.replace(/\[PAUSE \d+s\]/g, ''), // Remove pause markers for TTS
          preset: "fast"
        }
      }
    );

    // The response should be a URL to the generated audio
    const audioUrl = Array.isArray(ttsResponse) ? ttsResponse[0] : ttsResponse;

    if (!audioUrl) {
      throw new Error('Failed to generate audio from TTS service');
    }

    // Download and upload the audio to Supabase Storage
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error('Failed to download generated audio');
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const fileName = `meditation-${uuidv4()}-${Date.now()}.wav`;
    const filePath = `${user.id}/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('meditations')
      .upload(filePath, audioBuffer, {
        contentType: 'audio/wav',
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Error uploading meditation audio:', uploadError);
      return res.status(500).json({ error: 'Failed to upload meditation audio' });
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('meditations')
      .getPublicUrl(filePath);

    const meditationAudioUrl = urlData.publicUrl;

    // Create playlist with speech and pause segments
    const playlist = [{
      type: 'speech',
      url: meditationAudioUrl,
      duration: duration // Approximate duration
    }];

    // Save meditation to database
    const meditationData = {
      user_id: user.id,
      title: `Reflection on ${new Date().toLocaleDateString()}`,
      script: script,
      playlist: JSON.stringify(playlist),
      note_ids: noteIds,
      duration: duration,
      summary: summary,
      time_of_reflection: new Date().toISOString()
    };

    const { data: meditation, error: saveError } = await supabase
      .from('meditations')
      .insert([meditationData])
      .select()
      .single();

    if (saveError) {
      console.error('Error saving meditation:', saveError);
      return res.status(500).json({ error: 'Failed to save meditation' });
    }

    return res.status(201).json({
      id: meditation.id,
      title: meditation.title,
      playlist: playlist,
      duration: duration,
      script: script,
      noteCount: notes.length,
      createdAt: meditation.time_of_reflection
    });

  } catch (error) {
    console.error('Meditation API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}