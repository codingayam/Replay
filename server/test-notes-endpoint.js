#!/usr/bin/env node

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testNotesEndpoint() {
    try {
        console.log('🧪 Testing Notes Date Range Functionality...\n');
        
        // Test 1: Sign in with test user (you'll need to use a real user email/password)
        console.log('1. Testing user authentication...');
        const testEmail = 'testuser@gmail.com';  // Replace with your actual email
        const testPassword = 'password123';      // Replace with your actual password
        
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: testEmail,
            password: testPassword,
        });
        
        if (signInError) {
            console.error('❌ Login failed:', signInError.message);
            console.log('👉 Please update the email/password in test-notes-endpoint.js with your actual credentials');
            return;
        }
        
        console.log('✅ User login successful');
        const userId = signInData.user.id;
        console.log(`   User ID: ${userId}`);
        
        // Test 2: Check raw notes data
        console.log('\n2. Checking raw notes data...');
        const { data: allNotes, error: notesError } = await supabase
            .from('notes')
            .select('id, user_id, clerk_user_id, title, date, created_at')
            .order('created_at', { ascending: false })
            .limit(5);
            
        if (notesError) {
            console.error('❌ Error fetching notes:', notesError);
            return;
        }
        
        console.log(`✅ Found ${allNotes.length} recent notes in database:`);
        allNotes.forEach(note => {
            console.log(`   - ID: ${note.id}`);
            console.log(`     user_id: ${note.user_id || 'NULL'}`);
            console.log(`     clerk_user_id: ${note.clerk_user_id || 'NULL'}`);
            console.log(`     title: ${note.title}`);
            console.log(`     date: ${note.date}`);
            console.log(`     belongs_to_current_user: ${note.user_id === userId ? 'YES' : 'NO'}\n`);
        });
        
        // Test 3: Check notes for current user
        console.log('3. Checking notes for current authenticated user...');
        const { data: userNotes, error: userNotesError } = await supabase
            .from('notes')
            .select('*')
            .eq('user_id', userId)
            .order('date', { ascending: false });
            
        if (userNotesError) {
            console.error('❌ Error fetching user notes:', userNotesError);
            return;
        }
        
        console.log(`✅ Found ${userNotes.length} notes for current user`);
        
        if (userNotes.length === 0) {
            console.log('⚠️  No notes found for current user - this explains the empty experience selection!');
            console.log('   This suggests the data recovery process needs to be completed.');
        } else {
            console.log('   Recent notes:');
            userNotes.slice(0, 3).forEach(note => {
                console.log(`   - ${note.title} (${note.date})`);
            });
        }
        
        // Test 4: Test date range query (last 30 days)
        console.log('\n4. Testing date range query (last 30 days)...');
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const today = new Date();
        
        const { data: rangeNotes, error: rangeError } = await supabase
            .from('notes')
            .select('*')
            .eq('user_id', userId)
            .gte('date', thirtyDaysAgo.toISOString())
            .lte('date', today.toISOString())
            .order('date', { ascending: false });
            
        if (rangeError) {
            console.error('❌ Error with date range query:', rangeError);
            return;
        }
        
        console.log(`✅ Found ${rangeNotes.length} notes in last 30 days`);
        
        // Test 5: Check for orphaned notes
        console.log('\n5. Checking for orphaned notes (user_id = NULL)...');
        const { data: orphanedNotes, error: orphanedError } = await supabase
            .from('notes')
            .select('id, clerk_user_id, title, date')
            .is('user_id', null)
            .not('clerk_user_id', 'is', null)
            .limit(5);
            
        if (orphanedError) {
            console.error('❌ Error checking orphaned notes:', orphanedError);
            return;
        }
        
        if (orphanedNotes.length > 0) {
            console.log(`⚠️  Found ${orphanedNotes.length} orphaned notes that need user_id assignment:`);
            orphanedNotes.forEach(note => {
                console.log(`   - ${note.title} (clerk_user_id: ${note.clerk_user_id})`);
            });
            console.log(`\n💡 To recover these, run:`);
            console.log(`   UPDATE notes SET user_id = '${userId}' WHERE user_id IS NULL AND clerk_user_id IS NOT NULL;`);
        } else {
            console.log('✅ No orphaned notes found');
        }
        
        console.log('\n🎉 Diagnosis complete!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testNotesEndpoint();