const { createClient } = require('@supabase/supabase-js');

async function addUniqueConstraint() {
    try {
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        
        console.log('Adding unique constraint to profiles table...');
        
        // Use raw SQL to add unique constraint
        const { data, error } = await supabase.rpc('exec_sql', {
            sql: `
                ALTER TABLE profiles 
                ADD CONSTRAINT profiles_user_id_unique 
                UNIQUE (user_id);
            `
        });
        
        if (error) {
            console.error('Error adding unique constraint:', error);
            // If constraint already exists, that's fine
            if (error.message?.includes('already exists')) {
                console.log('✅ Unique constraint already exists.');
                return;
            }
            throw error;
        }
        
        console.log('✅ Unique constraint added successfully:', data);
        
    } catch (error) {
        console.error('Error during constraint addition:', error);
    }
}

// Run if this script is executed directly
if (require.main === module) {
    addUniqueConstraint();
}

module.exports = { addUniqueConstraint };