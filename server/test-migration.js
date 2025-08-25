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

async function testMigration() {
    try {
        console.log('🧪 Testing Supabase Migration...\n');
        
        // Test 1: Check if tables have user_id columns
        console.log('1. Checking database schema...');
        
        const { data: columns, error: schemaError } = await supabase
            .from('information_schema.columns')
            .select('table_name, column_name')
            .in('table_name', ['profiles', 'notes', 'meditations'])
            .eq('column_name', 'user_id');
            
        if (schemaError) {
            console.error('❌ Schema check failed:', schemaError);
        } else {
            const tables = columns.map(c => c.table_name);
            console.log(`✅ user_id columns found in: ${tables.join(', ')}`);
        }
        
        // Test 2: Check storage buckets
        console.log('\n2. Checking storage buckets...');
        
        const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
        
        if (bucketError) {
            console.error('❌ Storage check failed:', bucketError);
        } else {
            const bucketNames = buckets.map(b => b.name);
            const expectedBuckets = ['audio', 'images', 'profiles'];
            const missingBuckets = expectedBuckets.filter(name => !bucketNames.includes(name));
            
            if (missingBuckets.length === 0) {
                console.log('✅ All storage buckets found:', bucketNames.filter(name => expectedBuckets.includes(name)).join(', '));
            } else {
                console.log('⚠️  Missing buckets:', missingBuckets.join(', '));
                console.log('   Found buckets:', bucketNames.join(', '));
            }
        }
        
        // Test 3: Test authentication (create a test user)
        console.log('\n3. Testing authentication...');
        
        const testEmail = 'test-migration@example.com';
        const testPassword = 'test123456';
        
        // Try to sign up a test user
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: testEmail,
            password: testPassword,
        });
        
        if (authError && !authError.message.includes('already registered')) {
            console.error('❌ Auth test failed:', authError);
        } else {
            console.log('✅ Authentication working (test user signup successful or user already exists)');
        }
        
        console.log('\n🎉 Migration test completed!');
        console.log('\nNext steps:');
        console.log('1. Try logging into your app with a new email/password');
        console.log('2. Test uploading an audio note or photo');
        console.log('3. Verify files are stored in Supabase Storage');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

testMigration();