// Shared middleware for Vercel API functions
import { createClient } from '@supabase/supabase-js';
import multer from 'multer';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Auth middleware
async function verifyAuth(req) {
  const authHeader = req.headers.authorization;
  console.log('Auth header present:', !!authHeader);
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('No valid authorization header found');
    throw new Error('No authorization token');
  }

  const token = authHeader.substring(7);
  console.log('Token length:', token.length);
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error) {
      console.error('Supabase auth error:', error);
      throw new Error('Invalid token');
    }
    if (!user) {
      console.error('No user found for token');
      throw new Error('Invalid token');
    }
    console.log('User authenticated:', user.id);
    return user;
  } catch (error) {
    console.error('Authentication failed:', error);
    throw new Error('Authentication failed');
  }
}

// Multer setup for memory storage
const uploadAudio = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

const uploadImage = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const uploadProfileImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

export {
  verifyAuth,
  supabase,
  uploadAudio,
  uploadImage,
  uploadProfileImage
};