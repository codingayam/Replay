// Vercel serverless function for managing meditations
import { verifyAuth, supabase } from './_middleware.js';

export default async function handler(req, res) {
  try {
    // Verify authentication
    const user = await verifyAuth(req);

    if (req.method === 'GET') {
      // Get user's meditations
      const { data: meditations, error } = await supabase
        .from('meditations')
        .select('id, title, duration, time_of_reflection, summary')
        .eq('user_id', user.id)
        .order('time_of_reflection', { ascending: false });

      if (error) {
        throw error;
      }

      return res.status(200).json(meditations);
    }

    if (req.method === 'DELETE') {
      // Delete all user's meditations
      const { error } = await supabase
        .from('meditations')
        .delete()
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      return res.status(200).json({ message: 'All meditations deleted successfully' });
    }

    // Method not allowed
    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Meditations API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}