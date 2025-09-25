export function registerProfileRoutes(deps) {
  const { app, requireAuth, supabase, upload, uuidv4 } = deps;

  // ============= PROFILE API ROUTES =============

  // GET /api/profile - Get user profile
  app.get('/api/profile', requireAuth(), async (req, res) => {
    try {
      const userId = req.auth.userId;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching profile:', error);
        return res.status(500).json({ error: 'Failed to fetch profile' });
      }

      // If no profile exists, return null (user hasn't completed onboarding)
      if (!profile) {
        return res.json({ profile: null });
      }

      res.json({ profile });
    } catch (error) {
      console.error('Profile fetch error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/profile - Update user profile
  app.post('/api/profile', requireAuth(), async (req, res) => {
    try {
      const userId = req.auth.userId;
      const { name, values, mission, thinking_about } = req.body;

      // Check if profile already exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .single();

      let profileData;

      if (existingProfile) {
        // Update existing profile
        const { data, error } = await supabase
          .from('profiles')
          .update({
            name,
            values,
            mission,
            thinking_about,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .select()
          .single();

        if (error) {
          console.error('Error updating profile:', error);
          return res.status(500).json({ error: 'Failed to update profile' });
        }

        profileData = data;
      } else {
        // Create new profile
        const { data, error } = await supabase
          .from('profiles')
          .insert([{
            user_id: userId,
            name,
            values,
            mission,
            thinking_about
          }])
          .select()
          .single();

        if (error) {
          console.error('Error creating profile:', error);
          return res.status(500).json({ error: 'Failed to create profile' });
        }

        profileData = data;
      }

      res.json({ profile: profileData });
    } catch (error) {
      console.error('Profile update error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/profile/image - Upload profile image
  app.post('/api/profile/image', requireAuth(), upload.single('profileImage'), async (req, res) => {
    try {
      const userId = req.auth.userId;

      if (!req.file) {
        return res.status(400).json({ error: 'Profile image file is required' });
      }

      // Generate unique filename
      const imageId = uuidv4();
      const fileExtension = req.file.originalname.split('.').pop();
      const fileName = `${imageId}.${fileExtension}`;

      // Delete old profile image if it exists
      try {
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('profile_image_url')
          .eq('user_id', userId)
          .single();

        if (existingProfile?.profile_image_url) {
          // Extract file path from existing URL for deletion
          const oldFilePath = existingProfile.profile_image_url.split('/').slice(-2).join('/');
          await supabase.storage.from('profiles').remove([oldFilePath]);
        }
      } catch (deleteError) {
        console.error('Error deleting old profile image:', deleteError);
        // Continue with upload even if deletion fails
      }

      // Upload new profile image to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(`${userId}/${fileName}`, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        return res.status(500).json({ error: 'Failed to upload profile image' });
      }

      // Get signed URL for the uploaded file
      const { data: urlData } = await supabase.storage
        .from('profiles')
        .createSignedUrl(`${userId}/${fileName}`, 3600 * 24 * 365); // 1 year

      // Update profile with new image URL
      const { data: profileData, error: updateError } = await supabase
        .from('profiles')
        .update({
          profile_image_url: urlData?.signedUrl || `${userId}/${fileName}`,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating profile with image URL:', updateError);
        return res.status(500).json({ error: 'Failed to update profile with image' });
      }

      res.json({ 
        profile: profileData,
        imageUrl: urlData?.signedUrl || `${userId}/${fileName}`
      });
    } catch (error) {
      console.error('Profile image upload error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}
