-- Migration: Add unique constraint to profiles table and clean up duplicates
-- This ensures only one profile record per user

-- First, identify and keep only the most recent profile for each user
-- Delete all duplicate profiles except the one with the latest updated_at timestamp
WITH ranked_profiles AS (
    SELECT id,
           user_id,
           ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC) as rn
    FROM profiles
)
DELETE FROM profiles 
WHERE id IN (
    SELECT id 
    FROM ranked_profiles 
    WHERE rn > 1
);

-- Add unique constraint on user_id to prevent future duplicates
ALTER TABLE profiles 
ADD CONSTRAINT profiles_user_id_unique 
UNIQUE (user_id);

-- Verify the constraint was added successfully
SELECT 
    conname as constraint_name,
    contype as constraint_type
FROM pg_constraint 
WHERE conrelid = 'profiles'::regclass 
AND contype = 'u';