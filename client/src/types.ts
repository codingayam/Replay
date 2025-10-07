
export interface Note {
    id: string;
    title: string;
    date: string;
    transcript: string; // For audio: transcription, for photo: AI-enhanced caption, for text: user content
    type: 'audio' | 'photo' | 'text';
    audioUrl?: string; // Only for audio notes
    imageUrl?: string; // For photo notes and optional text note images
    originalCaption?: string; // Only for photo notes - user's original caption
    aiImageDescription?: string; // For photo notes and optional text note images - standalone AI vision analysis
    userTitle?: string; // For text notes - user-provided custom title
}

export interface Profile {
    name: string;
    values: string;
    mission: string;
    thinking_about?: string;
    profileImageUrl?: string;
}

export interface SearchResult {
    id: string;
    title: string;
    date: string;
    type: 'audio' | 'photo' | 'text';
    snippet: {
        text: string;
        matchCount: number;
    };
}
