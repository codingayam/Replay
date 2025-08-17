
export interface Note {
    id: string;
    title: string;
    date: string;
    transcript: string; // For audio: transcription, for photo: AI-enhanced caption
    type: 'audio' | 'photo';
    audioUrl?: string; // Only for audio notes
    imageUrl?: string; // Only for photo notes  
    originalCaption?: string; // Only for photo notes - user's original caption
}
