#!/usr/bin/env node

// Fix profile image URLs migration script
// This script updates existing profile image URLs from /images/ format to /profiles/ format
// and optionally migrates the files to the correct bucket

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { supabase } = require('./middleware/auth');
const { db } = require('./database');

async function migrateProfileImageUrls() {
    console.log('Starting profile image URL migration...');
    
    try {
        // Get all profiles with image URLs
        const { data: profiles, error } = await supabase
            .from('profiles')
            .select('id, user_id, profile_image_url')
            .not('profile_image_url', 'is', null)
            .neq('profile_image_url', '');

        if (error) {
            throw error;
        }

        console.log(`Found ${profiles.length} profiles with profile images`);

        for (const profile of profiles) {
            const oldUrl = profile.profile_image_url;
            
            // Check if URL is in old format (/images/...)
            if (oldUrl && oldUrl.startsWith('/images/')) {
                // Convert to new format
                const newUrl = oldUrl.replace('/images/', '/profiles/');
                
                console.log(`Migrating profile ${profile.user_id}:`);
                console.log(`  Old URL: ${oldUrl}`);
                console.log(`  New URL: ${newUrl}`);
                
                // Update the profile with new URL
                const { error: updateError } = await supabase
                    .from('profiles')
                    .update({ profile_image_url: newUrl })
                    .eq('id', profile.id);
                    
                if (updateError) {
                    console.error(`Failed to update profile ${profile.user_id}:`, updateError);
                } else {
                    console.log(`✅ Updated profile ${profile.user_id} successfully`);
                }
                
                // Optional: Try to move the file from images bucket to profiles bucket
                try {
                    // Extract filename from URL
                    const pathParts = oldUrl.split('/');
                    const userId = pathParts[2];
                    const filename = pathParts[3];
                    const sourcePath = `${userId}/${filename}`;
                    
                    // Check if file exists in images bucket
                    const { data: sourceFile, error: downloadError } = await supabase.storage
                        .from('images')
                        .download(sourcePath);
                        
                    if (downloadError) {
                        console.log(`⚠️  File not found in images bucket: ${sourcePath}`);
                        continue;
                    }
                    
                    // Upload to profiles bucket
                    const { error: uploadError } = await supabase.storage
                        .from('profiles')
                        .upload(sourcePath, sourceFile, {
                            upsert: true
                        });
                        
                    if (uploadError) {
                        console.error(`Failed to upload to profiles bucket:`, uploadError);
                    } else {
                        console.log(`✅ Migrated file to profiles bucket: ${sourcePath}`);
                        
                        // Optionally delete from images bucket
                        const { error: deleteError } = await supabase.storage
                            .from('images')
                            .remove([sourcePath]);
                            
                        if (deleteError) {
                            console.log(`⚠️  Could not delete from images bucket: ${sourcePath}`);
                        } else {
                            console.log(`✅ Cleaned up old file from images bucket: ${sourcePath}`);
                        }
                    }
                    
                } catch (fileError) {
                    console.log(`⚠️  Could not migrate file for profile ${profile.user_id}:`, fileError.message);
                }
            } else {
                console.log(`Profile ${profile.user_id} already has correct URL format: ${oldUrl}`);
            }
        }
        
        console.log('✅ Profile image URL migration completed!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

// Run the migration
if (require.main === module) {
    migrateProfileImageUrls()
        .then(() => {
            console.log('Migration script completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration script failed:', error);
            process.exit(1);
        });
}

module.exports = { migrateProfileImageUrls };