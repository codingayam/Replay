-- Enhanced Storage Setup - Run in Supabase Dashboard SQL Editor
-- This includes a separate bucket for meditation audio files

-- Storage buckets to create via Dashboard UI:

-- 1. audio (user voice recordings)
-- Name: audio
-- Public: false
-- File size limit: 52428800 (50MB)
-- Allowed MIME types: audio/wav, audio/mpeg

-- 2. images (photo uploads)  
-- Name: images
-- Public: false
-- File size limit: 10485760 (10MB)
-- Allowed MIME types: image/jpeg, image/jpg, image/png, image/gif, image/webp

-- 3. profiles (profile pictures)
-- Name: profiles  
-- Public: false
-- File size limit: 5242880 (5MB)
-- Allowed MIME types: image/jpeg, image/jpg, image/png, image/webp

-- 4. meditations (generated meditation audio files)
-- Name: meditations
-- Public: false
-- File size limit: 104857600 (100MB - larger for longer meditations)
-- Allowed MIME types: audio/mpeg, audio/mp3, audio/wav

-- Storage policies for all buckets:
-- (Run this after creating the buckets via UI)

-- Audio bucket policies (user voice recordings)
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

-- Meditations bucket policies (generated meditation audio)
CREATE POLICY "Users can view their own meditation files" ON storage.objects
    FOR SELECT USING (bucket_id = 'meditations' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own meditation files" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'meditations' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own meditation files" ON storage.objects
    FOR UPDATE USING (bucket_id = 'meditations' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own meditation files" ON storage.objects
    FOR DELETE USING (bucket_id = 'meditations' AND auth.uid()::text = (storage.foldername(name))[1]);