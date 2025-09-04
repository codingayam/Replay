
export interface Note {
    id: string;
    title: string;
    date: string;
    transcript: string; // For audio: transcription, for photo: AI-enhanced caption (combined user + AI)
    type: 'audio' | 'photo';
    category?: ('ideas' | 'feelings')[]; // AI-generated categories array
    audioUrl?: string; // Only for audio notes
    imageUrl?: string; // Only for photo notes  
    originalCaption?: string; // Only for photo notes - user's original caption
    aiImageDescription?: string; // Only for photo notes - standalone AI vision analysis
}

export interface Profile {
    name: string;
    values: string;
    mission: string;
    profileImageUrl?: string;
}
