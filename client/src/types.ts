
export interface Note {
    id: string;
    title: string;
    date: string;
    transcript: string; // For audio: transcription, for photo: AI-enhanced caption
    type: 'audio' | 'photo';
    category?: 'gratitude' | 'experience' | 'reflection' | 'insight'; // AI-generated category
    audioUrl?: string; // Only for audio notes
    imageUrl?: string; // Only for photo notes  
    originalCaption?: string; // Only for photo notes - user's original caption
}

export interface Profile {
    name: string;
    values: string;
    mission: string;
    profileImageUrl?: string;
}
