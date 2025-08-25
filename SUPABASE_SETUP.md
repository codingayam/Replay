# Supabase Setup for Audio Upload Fix

## Required Storage Buckets

The application requires three storage buckets to be created in Supabase:

### 1. Audio Bucket
- **Name**: `audio`  
- **Public**: False (private bucket with signed URLs)
- **File size limit**: 50MB
- **Allowed file types**: audio/wav, audio/mpeg, audio/mp4
- **Folder structure**: `{user_id}/{filename}.wav`

### 2. Images Bucket  
- **Name**: `images`
- **Public**: True (for photo notes)
- **File size limit**: 10MB
- **Allowed file types**: image/jpeg, image/png, image/webp
- **Folder structure**: `{user_id}/{filename}.jpg|png|webp`

### 3. Profiles Bucket
- **Name**: `profiles`  
- **Public**: True (for profile pictures)
- **File size limit**: 5MB
- **Allowed file types**: image/jpeg, image/png
- **Folder structure**: `{user_id}/profile.{ext}`

## Storage Policies (RLS)

For each bucket, you need to set up Row Level Security policies:

### Audio Bucket Policies
```sql
-- Allow users to upload to their own folder
CREATE POLICY "Users can upload own audio files" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'audio' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to read their own audio files
CREATE POLICY "Users can read own audio files" ON storage.objects
FOR SELECT USING (
  bucket_id = 'audio' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own audio files
CREATE POLICY "Users can delete own audio files" ON storage.objects
FOR DELETE USING (
  bucket_id = 'audio' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);
```

### Images Bucket Policies
```sql
-- Allow users to upload to their own folder
CREATE POLICY "Users can upload own images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'images' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to read their own images
CREATE POLICY "Users can read own images" ON storage.objects
FOR SELECT USING (
  bucket_id = 'images' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own images
CREATE POLICY "Users can delete own images" ON storage.objects
FOR DELETE USING (
  bucket_id = 'images' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);
```

### Profiles Bucket Policies
```sql
-- Allow users to upload to their own folder
CREATE POLICY "Users can upload own profile images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'profiles' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to read their own profile images
CREATE POLICY "Users can read own profile images" ON storage.objects
FOR SELECT USING (
  bucket_id = 'profiles' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update their own profile images
CREATE POLICY "Users can update own profile images" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'profiles' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own profile images
CREATE POLICY "Users can delete own profile images" ON storage.objects
FOR DELETE USING (
  bucket_id = 'profiles' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);
```

## Environment Variables Required

Ensure these environment variables are set in Vercel:

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anonymous key  
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (private)
- `GEMINI_API_KEY` - Google Generative AI API key for transcription

## Testing the Setup

After creating the buckets and policies:

1. Test the debug endpoint: `GET https://your-domain.vercel.app/api/debug`
2. Test audio upload: `POST https://your-domain.vercel.app/api/notes` with multipart form data
3. Check Supabase storage dashboard for uploaded files
4. Verify that signed URLs are generated correctly for audio playback

## Troubleshooting

If you get 500 errors:
1. Check Vercel function logs for specific error messages
2. Verify all environment variables are set
3. Ensure storage buckets exist and have correct policies
4. Check that the user is authenticated and JWT token is valid
5. Verify Gemini API key is working by testing transcription separately