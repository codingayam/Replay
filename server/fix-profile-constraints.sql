-- Fix profiles table constraints for Supabase upsert operations
-- Run this in your Supabase Dashboard > SQL Editor

-- 1. Add unique constraint on user_id if it doesn't exist
ALTER TABLE profiles ADD CONSTRAINT IF NOT EXISTS profiles_user_id_unique UNIQUE (user_id);

-- 2. Verify the constraint was created
SELECT 
    conname as constraint_name,
    contype as constraint_type
FROM pg_constraint 
WHERE conrelid = 'profiles'::regclass 
    AND conname LIKE '%user_id%';