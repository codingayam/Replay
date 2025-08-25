const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const db = {
    // Profile operations
    async getProfile(userId) {
        console.log('DB: Getting profile for userId:', userId);
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false })
            .limit(1);
        
        console.log('DB: Profile query result - data:', data, 'error:', error);
        
        if (error) {
            console.log('DB: Profile query failed with error:', error);
            throw error;
        }
        
        if (!data || data.length === 0) {
            console.log('DB: No profile data found, returning null');
            return null;
        }
        
        // Take the most recent profile record
        const profileData = data[0];
        
        // Map database field names to expected API field names
        const mappedProfile = {
            ...profileData,
            profileImageUrl: profileData.profile_image_url
        };
        console.log('DB: Returning mapped profile:', mappedProfile);
        return mappedProfile;
    },

    async upsertProfile(userId, profileData) {
        console.log('DB: Upserting profile for userId:', userId, 'with data:', profileData);
        
        // For now, use update-or-insert pattern until unique constraint is added
        // First try to update existing profile
        const { data: updateData, error: updateError } = await supabase
            .from('profiles')
            .update({
                name: profileData.name,
                values: profileData.values,
                mission: profileData.mission,
                profile_image_url: profileData.profileImageUrl,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId)
            .select()
            .single();
        
        // If update succeeded, return the result
        if (!updateError && updateData) {
            console.log('DB: Profile updated successfully:', updateData);
            const mappedProfile = {
                ...updateData,
                profileImageUrl: updateData.profile_image_url
            };
            console.log('DB: Returning updated profile:', mappedProfile);
            return mappedProfile;
        }
        
        // If update failed because no record exists, insert new record
        if (updateError && updateError.code === 'PGRST116') {
            console.log('DB: No existing profile found, inserting new profile');
            const { data: insertData, error: insertError } = await supabase
                .from('profiles')
                .insert({
                    user_id: userId,
                    name: profileData.name,
                    values: profileData.values,
                    mission: profileData.mission,
                    profile_image_url: profileData.profileImageUrl
                })
                .select()
                .single();
            
            if (insertError) {
                console.log('DB: Insert failed with error:', insertError);
                throw insertError;
            }
            
            console.log('DB: Profile inserted successfully:', insertData);
            const mappedProfile = {
                ...insertData,
                profileImageUrl: insertData.profile_image_url
            };
            console.log('DB: Returning inserted profile:', mappedProfile);
            return mappedProfile;
        }
        
        // If update failed for other reasons, throw the error
        console.log('DB: Update failed with error:', updateError);
        throw updateError;
    },

    // Note operations
    async getNotes(userId) {
        const { data, error } = await supabase
            .from('notes')
            .select('*')
            .eq('user_id', userId)
            .order('date', { ascending: false });
        
        if (error) throw error;
        
        // Map database field names to expected API field names
        return (data || []).map(note => ({
            ...note,
            audioUrl: note.audio_url,
            imageUrl: note.image_url,
            originalCaption: note.original_caption
        }));
    },

    async getNotesInDateRange(userId, startDate, endDate) {
        const { data, error } = await supabase
            .from('notes')
            .select('*')
            .eq('user_id', userId)
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date', { ascending: false });
        
        if (error) throw error;
        
        // Map database field names to expected API field names
        return (data || []).map(note => ({
            ...note,
            audioUrl: note.audio_url,
            imageUrl: note.image_url,
            originalCaption: note.original_caption
        }));
    },

    async createNote(userId, noteData) {
        const { data, error } = await supabase
            .from('notes')
            .insert({
                id: noteData.id,
                user_id: userId,
                title: noteData.title,
                transcript: noteData.transcript,
                category: noteData.category,
                type: noteData.type,
                date: noteData.date,
                duration: noteData.duration,
                audio_url: noteData.audioUrl,
                image_url: noteData.imageUrl,
                original_caption: noteData.originalCaption
            })
            .select()
            .single();
        
        if (error) throw error;
        
        // Map database field names to expected API field names
        return {
            ...data,
            audioUrl: data.audio_url,
            imageUrl: data.image_url,
            originalCaption: data.original_caption
        };
    },

    async updateNote(userId, noteId, updates) {
        const { data, error } = await supabase
            .from('notes')
            .update(updates)
            .eq('user_id', userId)
            .eq('id', noteId)
            .select()
            .single();
        
        if (error) throw error;
        
        // Map database field names to expected API field names
        return {
            ...data,
            audioUrl: data.audio_url,
            imageUrl: data.image_url,
            originalCaption: data.original_caption
        };
    },

    async deleteNote(userId, noteId) {
        const { data, error } = await supabase
            .from('notes')
            .delete()
            .eq('user_id', userId)
            .eq('id', noteId);
        
        if (error) throw error;
        return data;
    },

    // Meditation operations
    async createMeditation(userId, meditationData) {
        const { data, error } = await supabase
            .from('meditations')
            .insert({
                id: meditationData.id,
                user_id: userId,
                title: meditationData.title,
                playlist: JSON.stringify(meditationData.playlist),
                note_ids: meditationData.noteIds, // Send as array, not JSON string
                script: meditationData.script,
                duration: meditationData.duration,
                summary: meditationData.summary,
                time_of_reflection: meditationData.timeOfReflection
            })
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    async getMeditations(userId) {
        const { data, error } = await supabase
            .from('meditations')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        // Parse JSON fields and map database field names
        return (data || []).map(meditation => ({
            ...meditation,
            playlist: typeof meditation.playlist === 'string' ? JSON.parse(meditation.playlist) : meditation.playlist,
            noteIds: meditation.note_ids // note_ids is already an array from database
        }));
    },

    async getMeditation(userId, meditationId) {
        const { data, error } = await supabase
            .from('meditations')
            .select('*')
            .eq('user_id', userId)
            .eq('id', meditationId)
            .single();
        
        if (error && error.code !== 'PGRST116') {
            throw error;
        }
        
        if (!data) return null;
        
        // Parse JSON fields and map database field names
        return {
            ...data,
            playlist: typeof data.playlist === 'string' ? JSON.parse(data.playlist) : data.playlist,
            noteIds: data.note_ids // note_ids is already an array from database
        };
    },

    async deleteMeditation(userId, meditationId) {
        const { data, error } = await supabase
            .from('meditations')
            .delete()
            .eq('user_id', userId)
            .eq('id', meditationId);
        
        if (error) throw error;
        return data;
    }
};

module.exports = { db };