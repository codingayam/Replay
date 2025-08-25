-- Migration Script for Supabase Dashboard SQL Editor
-- Run this in your Supabase Dashboard > SQL Editor > New Query

-- 1. Add user_id columns to all tables (these will be UUIDs from Supabase auth)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;  
ALTER TABLE meditations ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_meditations_user_id ON meditations(user_id);

-- 3. Enable RLS on all tables (if not already enabled)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE meditations ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing RLS policies (these might not exist, so we use IF EXISTS)
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

-- 5. Create new RLS policies using auth.uid()
-- Profiles policies
CREATE POLICY "Users can see their own profile" ON profiles
    FOR SELECT USING (user_id = auth.uid());
    
CREATE POLICY "Users can insert their own profile" ON profiles  
    FOR INSERT WITH CHECK (user_id = auth.uid());
    
CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own profile" ON profiles
    FOR DELETE USING (user_id = auth.uid());

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

-- 6. IMPORTANT: After you verify everything works with the new user_id columns,
-- you can drop the old clerk_user_id columns by uncommenting these lines:
-- ALTER TABLE profiles DROP COLUMN IF EXISTS clerk_user_id;
-- ALTER TABLE notes DROP COLUMN IF EXISTS clerk_user_id;  
-- ALTER TABLE meditations DROP COLUMN IF EXISTS clerk_user_id;