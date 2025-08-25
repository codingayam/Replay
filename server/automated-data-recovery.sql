-- Automated Data Recovery Script
-- This attempts to match orphaned data to current users where possible

-- 1. Create a temporary mapping table to track recovery
CREATE TEMP TABLE recovery_mapping (
    clerk_user_id TEXT,
    supabase_user_id UUID,
    match_method TEXT,
    confidence TEXT
);

-- 2. Method 1: Try to match by profile name if there are current profiles
-- This assumes you might have recreated profiles with similar names
INSERT INTO recovery_mapping (clerk_user_id, supabase_user_id, match_method, confidence)
SELECT DISTINCT 
    orphaned.clerk_user_id,
    current_profile.user_id,
    'name_match',
    'medium'
FROM profiles orphaned
JOIN profiles current_profile ON LOWER(TRIM(orphaned.name)) = LOWER(TRIM(current_profile.name))
WHERE orphaned.user_id IS NULL 
    AND orphaned.clerk_user_id IS NOT NULL
    AND current_profile.user_id IS NOT NULL
    AND orphaned.id != current_profile.id;

-- 3. Show potential matches for manual review
SELECT 
    rm.clerk_user_id,
    rm.supabase_user_id,
    rm.match_method,
    rm.confidence,
    au.email as target_user_email,
    op.name as orphaned_profile_name,
    cp.name as current_profile_name,
    COUNT(notes.id) as orphaned_notes_count
FROM recovery_mapping rm
LEFT JOIN auth.users au ON au.id = rm.supabase_user_id
LEFT JOIN profiles op ON op.clerk_user_id = rm.clerk_user_id AND op.user_id IS NULL
LEFT JOIN profiles cp ON cp.user_id = rm.supabase_user_id
LEFT JOIN notes ON notes.clerk_user_id = rm.clerk_user_id AND notes.user_id IS NULL
GROUP BY rm.clerk_user_id, rm.supabase_user_id, rm.match_method, rm.confidence, 
         au.email, op.name, cp.name
ORDER BY orphaned_notes_count DESC;

-- 4. If you want to proceed with automatic recovery for high-confidence matches:
-- UNCOMMENT the following sections AFTER reviewing the matches above

/*
-- WARNING: This will merge data! Review matches carefully before running

-- Update profiles
UPDATE profiles 
SET user_id = rm.supabase_user_id,
    updated_at = NOW()
FROM recovery_mapping rm
WHERE profiles.clerk_user_id = rm.clerk_user_id 
    AND profiles.user_id IS NULL
    AND rm.confidence IN ('high', 'medium');

-- Update notes
UPDATE notes
SET user_id = rm.supabase_user_id,
    updated_at = NOW()  
FROM recovery_mapping rm
WHERE notes.clerk_user_id = rm.clerk_user_id
    AND notes.user_id IS NULL
    AND rm.confidence IN ('high', 'medium');

-- Update meditations
UPDATE meditations
SET user_id = rm.supabase_user_id,
    updated_at = NOW()
FROM recovery_mapping rm  
WHERE meditations.clerk_user_id = rm.clerk_user_id
    AND meditations.user_id IS NULL
    AND rm.confidence IN ('high', 'medium');
*/

-- 5. Alternative: Manual assignment for single user
-- If all orphaned data belongs to you, uncomment and update with your user ID:

/*
-- Get your current Supabase user ID (you'll see this in the query results)
SELECT id as your_supabase_user_id, email 
FROM auth.users 
WHERE email = 'YOUR_EMAIL@example.com';

-- Then run these updates with your actual user ID:
UPDATE profiles SET user_id = 'YOUR_ACTUAL_UUID_HERE' WHERE user_id IS NULL AND clerk_user_id IS NOT NULL;
UPDATE notes SET user_id = 'YOUR_ACTUAL_UUID_HERE' WHERE user_id IS NULL AND clerk_user_id IS NOT NULL;  
UPDATE meditations SET user_id = 'YOUR_ACTUAL_UUID_HERE' WHERE user_id IS NULL AND clerk_user_id IS NOT NULL;
*/