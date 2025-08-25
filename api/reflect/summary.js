// Vercel serverless function for generating reflection summaries
import { verifyAuth, supabase } from '../_middleware.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  try {
    // Verify authentication
    const user = await verifyAuth(req);

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { noteIds, duration = 300 } = req.body; // Default 5 minutes

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

    // Get user profile for personalization
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Generate reflection summary using Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const reflectionPrompt = `As a mindful reflection guide, create a thoughtful summary of these journal entries for a ${duration/60}-minute guided meditation.

User Profile:
${profile ? `
Name: ${profile.name || 'User'}
Values: ${profile.values || 'Not specified'}
Personal Mission: ${profile.mission || 'Not specified'}
` : 'Profile not available'}

Journal Entries:
${notes.map(note => `
Title: ${note.title}
Content: ${note.transcript}
Date: ${new Date(note.date).toLocaleDateString()}
Type: ${note.type}
`).join('\n')}

Please create:
1. A brief, insightful summary (2-3 sentences) highlighting the key themes and emotional threads
2. 2-3 key insights or patterns you notice across these experiences
3. A gentle reflection question for deeper contemplation

Keep the tone warm, supportive, and introspective. Focus on growth, self-awareness, and emotional intelligence.`;

    const result = await model.generateContent(reflectionPrompt);
    const summary = result.response.text();

    // Create a temporary reflection record for the meditation generation
    const reflectionData = {
      user_id: user.id,
      note_ids: noteIds,
      summary: summary,
      duration: duration,
      created_at: new Date().toISOString()
    };

    return res.status(200).json({
      summary,
      noteCount: notes.length,
      duration,
      notes: notes.map(note => ({
        id: note.id,
        title: note.title,
        date: note.date,
        type: note.type
      }))
    });

  } catch (error) {
    console.error('Reflection summary API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}