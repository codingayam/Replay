// Vercel serverless function for user profile management
import { verifyAuth, supabase, uploadProfileImage } from './_middleware.js';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  try {
    // Verify authentication
    const user = await verifyAuth(req);

    if (req.method === 'GET') {
      // Get user profile
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw error;
      }

      return res.status(200).json(profile || {});
    }

    if (req.method === 'POST') {
      const { name, values, mission } = req.body;

      // Upsert profile data
      const profileData = {
        user_id: user.id,
        name: name || null,
        values: values || null,
        mission: mission || null,
        updated_at: new Date().toISOString()
      };

      const { data: profile, error } = await supabase
        .from('profiles')
        .upsert(profileData, { 
          onConflict: 'user_id',
          returning: 'representation'
        })
        .select()
        .single();

      if (error) {
        console.error('Error upserting profile:', error);
        return res.status(500).json({ error: 'Failed to save profile' });
      }

      return res.status(200).json(profile);
    }

    // Method not allowed
    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Profile API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}