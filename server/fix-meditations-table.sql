-- Fix for meditations table - add user_id column and update references
-- Run this in Supabase Dashboard > SQL Editor

-- 1. Add user_id column to meditations table if it doesn't exist
ALTER TABLE meditations ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Create index for performance
CREATE INDEX IF NOT EXISTS idx_meditations_user_id ON meditations(user_id);

-- 3. Drop existing RLS policies for meditations table
DROP POLICY IF EXISTS "Users can only see their own meditations" ON meditations;
DROP POLICY IF EXISTS "Users can only create their own meditations" ON meditations;
DROP POLICY IF EXISTS "Users can only update their own meditations" ON meditations;
DROP POLICY IF EXISTS "Users can only delete their own meditations" ON meditations;

-- Drop any other existing policies on meditations
DROP POLICY IF EXISTS "Users can see their own meditations" ON meditations;
DROP POLICY IF EXISTS "Users can insert their own meditations" ON meditations;
DROP POLICY IF EXISTS "Users can update their own meditations" ON meditations;
DROP POLICY IF EXISTS "Users can delete their own meditations" ON meditations;

-- 4. Create new RLS policies using auth.uid()
CREATE POLICY "Users can see their own meditations" ON meditations
    FOR SELECT USING (user_id = auth.uid());
    
CREATE POLICY "Users can insert their own meditations" ON meditations
    FOR INSERT WITH CHECK (user_id = auth.uid());
    
CREATE POLICY "Users can update their own meditations" ON meditations  
    FOR UPDATE USING (user_id = auth.uid());
    
CREATE POLICY "Users can delete their own meditations" ON meditations
    FOR DELETE USING (user_id = auth.uid());

-- 5. Verify the changes
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'meditations' 
    AND column_name IN ('user_id', 'clerk_user_id')
ORDER BY column_name;