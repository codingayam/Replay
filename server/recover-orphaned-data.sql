-- Recover Orphaned Data from Clerk to Supabase Migration
-- Run this in Supabase Dashboard > SQL Editor

-- 1. First, let's see what orphaned data we have
SELECT 'profiles' as table_name, COUNT(*) as orphaned_count 
FROM profiles 
WHERE user_id IS NULL AND clerk_user_id IS NOT NULL

UNION ALL

SELECT 'notes' as table_name, COUNT(*) as orphaned_count 
FROM notes 
WHERE user_id IS NULL AND clerk_user_id IS NOT NULL

UNION ALL

SELECT 'meditations' as table_name, COUNT(*) as orphaned_count 
FROM meditations 
WHERE user_id IS NULL AND clerk_user_id IS NOT NULL;

-- 2. Check current Supabase auth users
SELECT 
    id as supabase_user_id,
    email,
    created_at
FROM auth.users 
ORDER BY created_at DESC;

-- 3. Show orphaned profiles with their clerk_user_ids
SELECT 
    id,
    clerk_user_id,
    name,
    values,
    mission,
    created_at
FROM profiles 
WHERE user_id IS NULL AND clerk_user_id IS NOT NULL
ORDER BY created_at DESC;

-- 4. Show orphaned notes with their clerk_user_ids  
SELECT 
    id,
    clerk_user_id,
    title,
    category,
    type,
    date,
    created_at
FROM notes 
WHERE user_id IS NULL AND clerk_user_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- MANUAL DATA RECOVERY STEPS:
-- After running the above queries, you'll need to manually assign orphaned data to users

-- Example: If you want to assign orphaned data to your current Supabase user
-- Replace 'YOUR_CURRENT_SUPABASE_USER_ID' with your actual auth.users.id

/*
-- Step A: Update profiles
UPDATE profiles 
SET user_id = 'YOUR_CURRENT_SUPABASE_USER_ID' 
WHERE user_id IS NULL AND clerk_user_id IS NOT NULL;

-- Step B: Update notes  
UPDATE notes
SET user_id = 'YOUR_CURRENT_SUPABASE_USER_ID'
WHERE user_id IS NULL AND clerk_user_id IS NOT NULL;

-- Step C: Update meditations
UPDATE meditations
SET user_id = 'YOUR_CURRENT_SUPABASE_USER_ID' 
WHERE user_id IS NULL AND clerk_user_id IS NOT NULL;
*/

-- 5. Verify the migration worked (run after manual assignment)
/*
SELECT 'profiles' as table_name, COUNT(*) as recovered_count 
FROM profiles 
WHERE user_id = 'YOUR_CURRENT_SUPABASE_USER_ID'

UNION ALL

SELECT 'notes' as table_name, COUNT(*) as recovered_count 
FROM notes 
WHERE user_id = 'YOUR_CURRENT_SUPABASE_USER_ID'

UNION ALL

SELECT 'meditations' as table_name, COUNT(*) as recovered_count 
FROM meditations 
WHERE user_id = 'YOUR_CURRENT_SUPABASE_USER_ID';
*/