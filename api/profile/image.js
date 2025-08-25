// Vercel serverless function for profile image upload
import { verifyAuth, supabase, uploadProfileImage } from '../_middleware.js';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  try {
    // Verify authentication
    const user = await verifyAuth(req);

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Handle multipart form data with multer
    await new Promise((resolve, reject) => {
      uploadProfileImage.single('profileImage')(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    if (!req.file) {
      return res.status(400).json({ error: 'No profile image file provided' });
    }

    const imageBuffer = req.file.buffer;
    const fileName = `${uuidv4()}-${Date.now()}.${req.file.mimetype.split('/')[1]}`;
    const filePath = `${user.id}/${fileName}`;

    // Upload image to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('profiles')
      .upload(filePath, imageBuffer, {
        contentType: req.file.mimetype,
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Error uploading profile image:', uploadError);
      return res.status(500).json({ error: 'Failed to upload profile image' });
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('profiles')
      .getPublicUrl(filePath);

    const imageUrl = urlData.publicUrl;

    // Update user's profile with the new image URL
    const { data: profile, error: updateError } = await supabase
      .from('profiles')
      .upsert({
        user_id: user.id,
        profile_image_url: imageUrl,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id',
        returning: 'representation'
      })
      .select()
      .single();

    if (updateError) {
      console.error('Error updating profile with image URL:', updateError);
      return res.status(500).json({ error: 'Failed to update profile' });
    }

    return res.status(200).json({
      message: 'Profile image uploaded successfully',
      profile_image_url: imageUrl,
      profile
    });

  } catch (error) {
    console.error('Profile image API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Disable body parser for multipart form data
export const config = {
  api: {
    bodyParser: false,
  },
};