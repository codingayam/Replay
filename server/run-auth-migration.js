#!/usr/bin/env node

require('dotenv').config();
const fs = require('fs');
const path = require('path');
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
        
        // Read the migration SQL file
        const migrationPath = path.join(__dirname, 'migrate-to-supabase-auth.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        // Split SQL into individual statements (simple approach)
        const statements = migrationSQL
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt && !stmt.startsWith('--') && stmt !== 'BEGIN' && stmt !== 'COMMIT');
        
        console.log(`Executing ${statements.length} migration statements...`);
        
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            if (statement) {
                console.log(`Executing statement ${i + 1}/${statements.length}...`);
                console.log(`SQL: ${statement.substring(0, 100)}...`);
                
                const { error } = await supabase.rpc('exec_sql', { 
                    sql_query: statement 
                });
                
                if (error) {
                    console.error(`Error executing statement ${i + 1}:`, error);
                    // Continue with other statements
                } else {
                    console.log(`✓ Statement ${i + 1} executed successfully`);
                }
            }
        }
        
        console.log('Migration completed!');
        
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

runMigration();