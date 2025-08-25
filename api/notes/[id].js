// Vercel serverless function for deleting notes by ID
import { verifyAuth, supabase } from '../_middleware.js';

export default async function handler(req, res) {
  try {
    // Verify authentication
    const user = await verifyAuth(req);

    if (req.method !== 'DELETE') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'Note ID is required' });
    }

    // First, get the note to verify ownership and get file URLs for cleanup
    const { data: note, error: fetchError } = await supabase
      .from('notes')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Delete associated files from Supabase Storage
    const deletePromises = [];

    if (note.audio_url) {
      // Extract file path from URL for audio files
      try {
        const audioPath = note.audio_url.split('/').pop();
        const fullAudioPath = `${user.id}/${audioPath}`;
        deletePromises.push(
          supabase.storage.from('audio').remove([fullAudioPath])
        );
      } catch (error) {
        console.error('Error deleting audio file:', error);
      }
    }

    if (note.image_url) {
      // Extract file path from URL for image files
      try {
        const imagePath = note.image_url.split('/').pop();
        const fullImagePath = `${user.id}/${imagePath}`;
        deletePromises.push(
          supabase.storage.from('images').remove([fullImagePath])
        );
      } catch (error) {
        console.error('Error deleting image file:', error);
      }
    }

    // Wait for file deletions (don't fail if files don't exist)
    if (deletePromises.length > 0) {
      await Promise.allSettled(deletePromises);
    }

    // Delete the note from database
    const { error: deleteError } = await supabase
      .from('notes')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Error deleting note:', deleteError);
      return res.status(500).json({ error: 'Failed to delete note' });
    }

    return res.status(200).json({ message: 'Note deleted successfully' });

  } catch (error) {
    console.error('Delete note API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}