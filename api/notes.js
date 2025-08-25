// Vercel serverless function for notes API
import { verifyAuth, supabase } from './_middleware.js';

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
      // Create new note
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

    // Method not allowed
    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Notes API error:', error);
    return res.status(401).json({ error: 'Unauthorized' });
  }
}