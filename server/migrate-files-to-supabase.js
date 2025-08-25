#!/usr/bin/env node

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function uploadFileToSupabase(bucket, filePath, fileBuffer, contentType) {
    const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, fileBuffer, {
            contentType,
            upsert: true // Replace if exists
        });
        
    if (error) throw error;
    return data;
}

async function migrateLocalFiles() {
    try {
        console.log('Starting file migration to Supabase Storage...');
        
        const dataDir = path.join(__dirname, 'data');
        
        // Migrate audio files
        console.log('\n📁 Migrating audio files...');
        const audioDir = path.join(dataDir, 'audio');
        
        try {
            const audioFiles = await fs.readdir(audioDir, { recursive: true });
            let audioCount = 0;
            
            for (const file of audioFiles) {
                const filePath = path.join(audioDir, file);
                const stats = await fs.stat(filePath);
                
                if (stats.isFile() && (file.endsWith('.wav') || file.endsWith('.mp3'))) {
                    console.log(`  Uploading: ${file}`);
                    const fileBuffer = await fs.readFile(filePath);
                    const contentType = file.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg';
                    
                    // Preserve the directory structure for user-specific files
                    await uploadFileToSupabase('audio', file, fileBuffer, contentType);
                    audioCount++;
                }
            }
            
            console.log(`  ✓ Migrated ${audioCount} audio files`);
            
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log('  No audio files directory found, skipping...');
            } else {
                throw error;
            }
        }
        
        // Migrate image files
        console.log('\n🖼️  Migrating image files...');
        const imagesDir = path.join(dataDir, 'images');
        
        try {
            const imageFiles = await fs.readdir(imagesDir, { recursive: true });
            let imageCount = 0;
            
            for (const file of imageFiles) {
                const filePath = path.join(imagesDir, file);
                const stats = await fs.stat(filePath);
                
                if (stats.isFile() && /\.(jpg|jpeg|png|gif|webp)$/i.test(file)) {
                    console.log(`  Uploading: ${file}`);
                    const fileBuffer = await fs.readFile(filePath);
                    const ext = path.extname(file).toLowerCase();
                    const contentType = {
                        '.jpg': 'image/jpeg',
                        '.jpeg': 'image/jpeg', 
                        '.png': 'image/png',
                        '.gif': 'image/gif',
                        '.webp': 'image/webp'
                    }[ext] || 'image/jpeg';
                    
                    await uploadFileToSupabase('images', file, fileBuffer, contentType);
                    imageCount++;
                }
            }
            
            console.log(`  ✓ Migrated ${imageCount} image files`);
            
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log('  No images directory found, skipping...');
            } else {
                throw error;
            }
        }
        
        console.log('\n🎉 File migration completed successfully!');
        console.log('\nNext steps:');
        console.log('1. Verify files are accessible via your app');
        console.log('2. Update any database records if needed');
        console.log('3. Consider backing up and removing local files after verification');
        
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrateLocalFiles();