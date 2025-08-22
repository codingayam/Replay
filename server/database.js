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
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('clerk_user_id', userId)
            .single();
        
        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
            throw error;
        }
        
        if (!data) return null;
        
        // Map database field names to expected API field names
        return {
            ...data,
            profileImageUrl: data.profile_image_url
        };
    },

    async upsertProfile(userId, profileData) {
        const { data, error } = await supabase
            .from('profiles')
            .upsert({
                clerk_user_id: userId,
                name: profileData.name,
                values: profileData.values,
                mission: profileData.mission,
                profile_image_url: profileData.profileImageUrl
            }, {
                onConflict: 'clerk_user_id'
            })
            .select()
            .single();
        
        if (error) throw error;
        
        // Map database field names to expected API field names
        return {
            ...data,
            profileImageUrl: data.profile_image_url
        };
    },

    // Note operations
    async getNotes(userId) {
        const { data, error } = await supabase
            .from('notes')
            .select('*')
            .eq('clerk_user_id', userId)
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
            .eq('clerk_user_id', userId)
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
                clerk_user_id: userId,
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
            .eq('clerk_user_id', userId)
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
            .eq('clerk_user_id', userId)
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
                clerk_user_id: userId,
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
            .eq('clerk_user_id', userId)
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
            .eq('clerk_user_id', userId)
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
            .eq('clerk_user_id', userId)
            .eq('id', meditationId);
        
        if (error) throw error;
        return data;
    }
};

module.exports = { db };