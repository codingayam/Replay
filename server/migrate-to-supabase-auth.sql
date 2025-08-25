-- Migration from Clerk Auth to Supabase Auth
-- This script updates the database schema to use Supabase auth.uid() instead of clerk_user_id

BEGIN;

-- 1. Add user_id columns to all tables (these will be UUIDs from Supabase auth)
ALTER TABLE profiles ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE notes ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;  
ALTER TABLE meditations ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Create indexes for performance
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_notes_user_id ON notes(user_id);
CREATE INDEX idx_meditations_user_id ON meditations(user_id);

-- 3. Update RLS policies to use auth.uid() instead of clerk_user_id

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Users can only see their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can only update their own profile" ON profiles; 
DROP POLICY IF EXISTS "Users can only see their own notes" ON notes;
DROP POLICY IF EXISTS "Users can only create their own notes" ON notes;
DROP POLICY IF EXISTS "Users can only update their own notes" ON notes;
DROP POLICY IF EXISTS "Users can only delete their own notes" ON notes;
DROP POLICY IF EXISTS "Users can only see their own meditations" ON meditations;
DROP POLICY IF EXISTS "Users can only create their own meditations" ON meditations;
DROP POLICY IF EXISTS "Users can only update their own meditations" ON meditations;
DROP POLICY IF EXISTS "Users can only delete their own meditations" ON meditations;

-- Create new RLS policies using auth.uid()
-- Profiles policies
CREATE POLICY "Users can see their own profile" ON profiles
    FOR SELECT USING (user_id = auth.uid());
    
CREATE POLICY "Users can insert their own profile" ON profiles  
    FOR INSERT WITH CHECK (user_id = auth.uid());
    
CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (user_id = auth.uid());

-- Notes policies  
CREATE POLICY "Users can see their own notes" ON notes
    FOR SELECT USING (user_id = auth.uid());
    
CREATE POLICY "Users can insert their own notes" ON notes
    FOR INSERT WITH CHECK (user_id = auth.uid());
    
CREATE POLICY "Users can update their own notes" ON notes
    FOR UPDATE USING (user_id = auth.uid());
    
CREATE POLICY "Users can delete their own notes" ON notes
    FOR DELETE USING (user_id = auth.uid());

-- Meditations policies
CREATE POLICY "Users can see their own meditations" ON meditations
    FOR SELECT USING (user_id = auth.uid());
    
CREATE POLICY "Users can insert their own meditations" ON meditations
    FOR INSERT WITH CHECK (user_id = auth.uid());
    
CREATE POLICY "Users can update their own meditations" ON meditations  
    FOR UPDATE USING (user_id = auth.uid());
    
CREATE POLICY "Users can delete their own meditations" ON meditations
    FOR DELETE USING (user_id = auth.uid());

-- 4. Note: After migration is complete and tested, we can drop the old columns:
-- ALTER TABLE profiles DROP COLUMN clerk_user_id;
-- ALTER TABLE notes DROP COLUMN clerk_user_id;  
-- ALTER TABLE meditations DROP COLUMN clerk_user_id;

COMMIT;