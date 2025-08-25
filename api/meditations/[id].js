// Vercel serverless function for individual meditation management
import { verifyAuth, supabase } from '../_middleware.js';

export default async function handler(req, res) {
  try {
    // Verify authentication
    const user = await verifyAuth(req);

    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'Meditation ID is required' });
    }

    if (req.method === 'GET') {
      // Get specific meditation
      const { data: meditation, error } = await supabase
        .from('meditations')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (error || !meditation) {
        return res.status(404).json({ error: 'Meditation not found' });
      }

      // Parse the playlist JSON
      let playlist = [];
      try {
        playlist = JSON.parse(meditation.playlist || '[]');
      } catch (e) {
        console.error('Error parsing playlist:', e);
      }

      return res.status(200).json({
        ...meditation,
        playlist
      });
    }

    if (req.method === 'DELETE') {
      // Delete specific meditation
      const { error } = await supabase
        .from('meditations')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting meditation:', error);
        return res.status(500).json({ error: 'Failed to delete meditation' });
      }

      return res.status(200).json({ message: 'Meditation deleted successfully' });
    }

    // Method not allowed
    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Meditation API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}