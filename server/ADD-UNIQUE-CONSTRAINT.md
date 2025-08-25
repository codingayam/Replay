# Add Unique Constraint to Profiles Table

To complete the profile uniqueness setup, add this SQL constraint through the Supabase Dashboard:

## Steps:
1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Run this SQL command:

```sql
ALTER TABLE profiles 
ADD CONSTRAINT profiles_user_id_unique 
UNIQUE (user_id);
```

## What this does:
- Prevents multiple profile records per user
- Enables proper PostgreSQL UPSERT operations
- Ensures data integrity

## After adding the constraint:
Update the `upsertProfile` function in `database.js` to use proper UPSERT:

```javascript
const { data, error } = await supabase
    .from('profiles')
    .upsert({
        user_id: userId,
        name: profileData.name,
        values: profileData.values,
        mission: profileData.mission,
        profile_image_url: profileData.profileImageUrl,
        updated_at: new Date().toISOString()
    }, {
        onConflict: 'user_id',
        ignoreDuplicates: false
    })
    .select()
    .single();
```

## Current Status:
✅ Duplicate profiles cleaned up (keeping only ID: 0ead32bd-65ee-42df-b7ce-181bd4e9542f)
✅ Update-or-insert pattern working correctly
⏳ Unique constraint needs to be added manually through Supabase Dashboard