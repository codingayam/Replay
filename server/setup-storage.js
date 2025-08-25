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

async function setupStorage() {
    try {
        console.log('Setting up Supabase Storage buckets...');
        
        // Create audio bucket
        console.log('Creating audio bucket...');
        const { data: audioBucket, error: audioError } = await supabase.storage.createBucket('audio', {
            public: false,
            allowedMimeTypes: ['audio/wav', 'audio/mpeg', 'audio/mp3'],
            fileSizeLimit: 50 * 1024 * 1024, // 50MB
        });
        
        if (audioError && audioError.message !== 'The resource already exists') {
            console.error('Error creating audio bucket:', audioError);
        } else {
            console.log('✓ Audio bucket ready');
        }
        
        // Create images bucket
        console.log('Creating images bucket...');
        const { data: imagesBucket, error: imagesError } = await supabase.storage.createBucket('images', {
            public: false,
            allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
            fileSizeLimit: 10 * 1024 * 1024, // 10MB
        });
        
        if (imagesError && imagesError.message !== 'The resource already exists') {
            console.error('Error creating images bucket:', imagesError);
        } else {
            console.log('✓ Images bucket ready');
        }
        
        // Create profiles bucket for profile images
        console.log('Creating profiles bucket...');
        const { data: profilesBucket, error: profilesError } = await supabase.storage.createBucket('profiles', {
            public: false,
            allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
            fileSizeLimit: 5 * 1024 * 1024, // 5MB
        });
        
        if (profilesError && profilesError.message !== 'The resource already exists') {
            console.error('Error creating profiles bucket:', profilesError);
        } else {
            console.log('✓ Profiles bucket ready');
        }
        
        console.log('\nStorage buckets setup completed!');
        console.log('\nNext steps:');
        console.log('1. Configure bucket policies in the Supabase dashboard');
        console.log('2. Set up RLS policies for user-specific access');
        
    } catch (error) {
        console.error('Setup failed:', error);
        process.exit(1);
    }
}

setupStorage();