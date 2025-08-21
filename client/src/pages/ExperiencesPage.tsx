import React, { useState, useEffect } from 'react';
import axios from 'axios';
import NoteCard from '../components/NoteCard';
import FloatingUploadButton from '../components/FloatingUploadButton';
import type { Note } from '../types';

const API_URL = '/api';

const ExperiencesPage: React.FC = () => {
    const [notes, setNotes] = useState<Note[]>([]);
    const [currentAudio, setCurrentAudio] = useState<string | null>(null);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

    const fetchNotes = async () => {
        try {
            const res = await axios.get(`${API_URL}/notes`);
            // Sort notes by date, most recent first
            const sortedNotes = res.data.sort((a: Note, b: Note) => 
                new Date(b.date).getTime() - new Date(a.date).getTime()
            );
            setNotes(sortedNotes);
        } catch (err) {
            console.error("Error fetching notes:", err);
        }
    };

    useEffect(() => {
        fetchNotes();
    }, []);

    const handleSaveAudioNote = async (blob: Blob) => {
        const formData = new FormData();
        formData.append('audio', blob, 'recording.wav');
        formData.append('localTimestamp', new Date().toISOString());
        try {
            await axios.post(`${API_URL}/notes`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            fetchNotes();
        } catch (err) {
            console.error("Error saving audio note:", err);
            alert('Failed to save audio note. See console for details.');
        }
    };

    const handleSavePhotoNote = async (file: File, caption: string) => {
        const formData = new FormData();
        formData.append('image', file);
        formData.append('caption', caption);
        formData.append('localTimestamp', new Date().toISOString());
        
        setIsUploadingPhoto(true);
        try {
            await axios.post(`${API_URL}/notes/photo`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            fetchNotes();
        } catch (err) {
            console.error("Error saving photo note:", err);
            alert('Failed to save photo note. See console for details.');
        } finally {
            setIsUploadingPhoto(false);
        }
    };

    const handleDeleteNote = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this note?')) {
            try {
                await axios.delete(`${API_URL}/notes/${id}`);
                fetchNotes();
            } catch (err) {
                console.error("Error deleting note:", err);
            }
        }
    };

    const handlePlayNote = (audioUrl: string) => {
        if (audioUrl) {
            setCurrentAudio(`${audioUrl}`);
        }
    };

    const handleUpdateTranscript = async (id: string, transcript: string) => {
        try {
            await axios.put(`${API_URL}/notes/${id}/transcript`, { transcript });
            fetchNotes(); // Refresh the notes to show the updated transcript
        } catch (err) {
            console.error("Error updating transcript:", err);
            alert('Failed to update transcript. See console for details.');
        }
    };



    return (
        <div style={styles.container}>
            {currentAudio && (
                <div className="card-enhanced" style={styles.playerContainer}>
                    <h3 style={styles.playerTitle}>Now Playing Note</h3>
                    <audio src={currentAudio} controls autoPlay key={currentAudio} style={styles.audioPlayer} />
                </div>
            )}

            <div style={styles.notesList}>
                {notes.map(note => (
                    <NoteCard 
                        key={note.id} 
                        note={note} 
                        onPlay={handlePlayNote} 
                        onDelete={handleDeleteNote} 
                        onUpdateTranscript={handleUpdateTranscript} 
                    />
                ))}
            </div>

            {notes.length === 0 && (
                <div style={styles.emptyState}>
                    <p style={styles.emptyText}>No experiences recorded yet.</p>
                    <p style={styles.emptySubtext}>Tap the Upload button to record your first daily note.</p>
                </div>
            )}

            <FloatingUploadButton 
                onSaveAudio={handleSaveAudioNote}
                onSavePhoto={handleSavePhotoNote}
                isUploadingPhoto={isUploadingPhoto}
            />
        </div>
    );
};

const styles = {
    container: {
        paddingBottom: '120px', // Space for FAB and bottom nav
        paddingTop: '1rem',
        paddingLeft: '1rem',
        paddingRight: '1rem',
    },
    playerContainer: { 
        padding: '1.25rem', 
        marginBottom: '1.5rem',
    },
    playerTitle: {
        color: 'var(--text-color)',
        fontSize: '1rem',
        fontWeight: '600',
        marginBottom: '0.75rem',
    },
    audioPlayer: {
        width: '100%',
        borderRadius: '8px',
    },
    notesList: {
        display: 'flex',
        flexDirection: 'column' as const,
    },
    emptyState: {
        textAlign: 'center' as const,
        marginTop: '3rem',
        color: '#666',
    },
    emptyText: {
        fontSize: '1.1rem',
        marginBottom: '0.5rem',
    },
    emptySubtext: {
        fontSize: '0.9rem',
        color: '#999',
    },
};

export default ExperiencesPage;