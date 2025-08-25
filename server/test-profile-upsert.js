const { db } = require('./database');

async function testProfileUpsert() {
    try {
        console.log('Testing profile upsert functionality...');
        
        const userId = '3c6b4e2c-b5a7-4e5b-80a6-811db4b576d2';
        
        // First, get the current profile
        console.log('\n1. Getting current profile...');
        const currentProfile = await db.getProfile(userId);
        console.log('Current profile:', currentProfile);
        
        // Update the profile with new data
        console.log('\n2. Updating profile...');
        const updatedProfile = await db.upsertProfile(userId, {
            name: 'Xu Jie',
            values: ['Creativity', 'Growth', 'Authenticity'],
            mission: 'To create innovative solutions that help people reflect and grow',
            profileImageUrl: null
        });
        console.log('Updated profile:', updatedProfile);
        
        // Verify the update
        console.log('\n3. Verifying update...');
        const verifiedProfile = await db.getProfile(userId);
        console.log('Verified profile:', verifiedProfile);
        
        console.log('\n✅ Profile upsert test completed successfully!');
        
    } catch (error) {
        console.error('❌ Error during profile upsert test:', error);
    }
}

// Run if this script is executed directly
if (require.main === module) {
    testProfileUpsert();
}

module.exports = { testProfileUpsert };