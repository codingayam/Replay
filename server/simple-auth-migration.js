#!/usr/bin/env node

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
    try {
        console.log('Running Supabase Auth migration...');
        
        // 1. Add user_id columns
        console.log('1. Adding user_id columns...');
        
        let { error } = await supabase.rpc('sql', {
            query: 'ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE'
        });
        if (error && !error.message.includes('already exists')) {
            console.error('Error adding user_id to profiles:', error);
        } else {
            console.log('✓ Added user_id to profiles');
        }
        
        ({ error } = await supabase.rpc('sql', {
            query: 'ALTER TABLE notes ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE'
        }));
        if (error && !error.message.includes('already exists')) {
            console.error('Error adding user_id to notes:', error);
        } else {
            console.log('✓ Added user_id to notes');
        }
        
        ({ error } = await supabase.rpc('sql', {
            query: 'ALTER TABLE meditations ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE'
        }));
        if (error && !error.message.includes('already exists')) {
            console.error('Error adding user_id to meditations:', error);
        } else {
            console.log('✓ Added user_id to meditations');
        }
        
        // 2. Create indexes
        console.log('2. Creating indexes...');
        
        ({ error } = await supabase.rpc('sql', {
            query: 'CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id)'
        }));
        if (error) {
            console.error('Error creating profiles index:', error);
        } else {
            console.log('✓ Created profiles index');
        }
        
        ({ error } = await supabase.rpc('sql', {
            query: 'CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id)'
        }));
        if (error) {
            console.error('Error creating notes index:', error);
        } else {
            console.log('✓ Created notes index');
        }
        
        ({ error } = await supabase.rpc('sql', {
            query: 'CREATE INDEX IF NOT EXISTS idx_meditations_user_id ON meditations(user_id)'
        }));
        if (error) {
            console.error('Error creating meditations index:', error);
        } else {
            console.log('✓ Created meditations index');
        }
        
        console.log('Migration completed successfully!');
        console.log('Note: RLS policies will need to be updated manually in the Supabase dashboard.');
        
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

runMigration();