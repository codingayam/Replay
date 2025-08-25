// Vercel serverless function for getting notes within date range
import { verifyAuth, supabase } from '../_middleware.js';

export default async function handler(req, res) {
  try {
    // Verify authentication
    const user = await verifyAuth(req);

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    // Get user's notes within date range
    let query = supabase
      .from('notes')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    const { data: notes, error } = await query;

    if (error) {
      throw error;
    }

    return res.status(200).json(notes);

  } catch (error) {
    console.error('Notes date range API error:', error);
    return res.status(401).json({ error: 'Unauthorized' });
  }
}