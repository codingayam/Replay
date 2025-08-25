const { db } = require('./database');

async function cleanupProfileDuplicates() {
    try {
        console.log('Starting profile cleanup...');
        
        const userId = '3c6b4e2c-b5a7-4e5b-80a6-811db4b576d2';
        const keepProfileId = '0ead32bd-65ee-42df-b7ce-181bd4e9542f';
        
        // First, let's see what profiles exist
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        
        console.log('Checking current profiles...');
        const { data: existingProfiles, error: selectError } = await supabase
            .from('profiles')
            .select('id, user_id, name, created_at, updated_at')
            .eq('user_id', userId);
            
        if (selectError) {
            console.error('Error selecting profiles:', selectError);
            return;
        }
        
        console.log('Found profiles:', existingProfiles);
        
        // Delete all profiles except the one we want to keep
        console.log(`Deleting all profiles except ${keepProfileId}...`);
        const { data: deleteData, error: deleteError } = await supabase
            .from('profiles')
            .delete()
            .eq('user_id', userId)
            .neq('id', keepProfileId);
            
        if (deleteError) {
            console.error('Error deleting duplicate profiles:', deleteError);
            return;
        }
        
        console.log('Delete result:', deleteData);
        
        // Verify only one profile remains
        const { data: remainingProfiles, error: verifyError } = await supabase
            .from('profiles')
            .select('id, user_id, name')
            .eq('user_id', userId);
            
        if (verifyError) {
            console.error('Error verifying cleanup:', verifyError);
            return;
        }
        
        console.log('Remaining profiles:', remainingProfiles);
        
        if (remainingProfiles.length === 1 && remainingProfiles[0].id === keepProfileId) {
            console.log('✅ Profile cleanup successful! Only the desired profile remains.');
        } else {
            console.log('❌ Something went wrong with the cleanup.');
        }
        
    } catch (error) {
        console.error('Error during profile cleanup:', error);
    }
}

// Run the cleanup if this script is executed directly
if (require.main === module) {
    cleanupProfileDuplicates();
}

module.exports = { cleanupProfileDuplicates };