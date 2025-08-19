import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar } from 'lucide-react';
import NoteCard from '../components/NoteCard';
import FloatingUploadButton from '../components/FloatingUploadButton';
import type { Note } from '../types';
import { groupNotesByDate, sortDateGroups } from '../utils/dateUtils';

const API_URL = '/api';

const ExperiencesPage: React.FC = () => {
    const [notes, setNotes] = useState<Note[]>([]);
    const [currentAudio, setCurrentAudio] = useState<string | null>(null);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

    const fetchNotes = async () => {
        try {
            const res = await axios.get(`${API_URL}/notes`);
            setNotes(res.data);
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
                {(() => {
                    const groupedNotes = groupNotesByDate(notes);
                    const sortedDateHeaders = sortDateGroups(Object.keys(groupedNotes));
                    
                    return sortedDateHeaders.map(dateHeader => {
                        const isToday = dateHeader === 'Today';
                        const dateFormatted = isToday ? 
                            new Date().toLocaleDateString('en-US', { 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                            }) : dateHeader;
                        
                        return (
                            <div key={dateHeader} style={styles.dateGroup}>
                                <div style={styles.dateHeaderContainer}>
                                    <div style={styles.dateHeaderContent}>
                                        <Calendar size={20} style={styles.calendarIcon} />
                                        <div>
                                            <h3 style={styles.dateHeader}>{dateHeader}</h3>
                                            {isToday && <p style={styles.dateSubtext}>{dateFormatted}</p>}
                                        </div>
                                    </div>
                                </div>
                                {groupedNotes[dateHeader].map(note => (
                                    <NoteCard key={note.id} note={note} onPlay={handlePlayNote} onDelete={handleDeleteNote} onUpdateTranscript={handleUpdateTranscript} />
                                ))}
                            </div>
                        );
                    });
                })()
            }
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
        paddingTop: '1.5rem', // Space after header
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
        gap: '1rem',
    },
    dateGroup: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '1rem',
        marginBottom: '2rem',
    },
    dateHeaderContainer: {
        marginBottom: '1rem',
    },
    dateHeaderContent: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
    },
    calendarIcon: {
        color: 'var(--primary-color)',
        flexShrink: 0,
    },
    dateHeader: {
        margin: 0,
        fontSize: '1.5rem',
        fontWeight: '700',
        color: 'var(--text-color)',
        fontFamily: 'var(--font-family-heading)',
        letterSpacing: '-0.025em',
    },
    dateSubtext: {
        margin: '0.25rem 0 0 0',
        fontSize: '0.9rem',
        color: 'var(--text-secondary)',
        fontFamily: 'var(--font-family)',
        fontWeight: '400',
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