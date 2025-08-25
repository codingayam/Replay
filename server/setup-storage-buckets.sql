-- Storage Setup Script for Supabase Dashboard
-- This creates the storage buckets and policies

-- Note: Bucket creation is typically done via the Dashboard UI or client libraries
-- If running via SQL, you may need to use the storage API functions

-- 1. Create storage buckets (you can also do this via Dashboard UI)
-- Go to Storage > Create Bucket in your Supabase dashboard and create:

-- Bucket: audio
-- Public: false
-- Allowed MIME types: audio/wav, audio/mpeg, audio/mp3
-- File size limit: 52428800 (50MB)

-- Bucket: images  
-- Public: false
-- Allowed MIME types: image/jpeg, image/jpg, image/png, image/gif, image/webp
-- File size limit: 10485760 (10MB)

-- Bucket: profiles
-- Public: false  
-- Allowed MIME types: image/jpeg, image/jpg, image/png, image/webp
-- File size limit: 5242880 (5MB)

-- 2. Set up storage policies for user-specific access
-- Run these in SQL Editor after creating the buckets:

-- Audio bucket policies
CREATE POLICY "Users can view their own audio files" ON storage.objects
    FOR SELECT USING (bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own audio files" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own audio files" ON storage.objects
    FOR UPDATE USING (bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own audio files" ON storage.objects
    FOR DELETE USING (bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Images bucket policies  
CREATE POLICY "Users can view their own images" ON storage.objects
    FOR SELECT USING (bucket_id = 'images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own images" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own images" ON storage.objects
    FOR UPDATE USING (bucket_id = 'images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own images" ON storage.objects
    FOR DELETE USING (bucket_id = 'images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Profiles bucket policies
CREATE POLICY "Users can view their own profile images" ON storage.objects
    FOR SELECT USING (bucket_id = 'profiles' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own profile images" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'profiles' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own profile images" ON storage.objects
    FOR UPDATE USING (bucket_id = 'profiles' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own profile images" ON storage.objects
    FOR DELETE USING (bucket_id = 'profiles' AND auth.uid()::text = (storage.foldername(name))[1]);