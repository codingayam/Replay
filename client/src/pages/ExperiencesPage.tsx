import React, { useState, useEffect, useRef } from 'react';
import { PlayCircle, Trash2, Share2, Image as ImageIcon, User } from 'lucide-react';
import FloatingUploadButton from '../components/FloatingUploadButton';
import SupabaseImage from '../components/SupabaseImage';
import type { Note } from '../types';
import { getCategoryInfo } from '../utils/categoryUtils';
import { useAuthenticatedApi, getFileUrl } from '../utils/api';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const ExperiencesPage: React.FC = () => {
    const [notes, setNotes] = useState<Note[]>([]);
    const [currentAudio, setCurrentAudio] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
    
    const api = useAuthenticatedApi();
    const { user } = useAuth();

    const fetchNotes = async () => {
        try {
            const res = await api.get('/notes');
            // Sort notes by date, most recent first
            const sortedNotes = res.data.notes.sort((a: Note, b: Note) => 
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
            await api.post('/notes', formData, {
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
            await api.post('/notes/photo', formData, {
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
                await api.delete(`/notes/${id}`);
                fetchNotes();
            } catch (err) {
                console.error("Error deleting note:", err);
            }
        }
    };

    const handlePlayNote = async (audioUrl: string) => {
        if (audioUrl && user) {
            try {
                let signedUrl = '';
                
                // Check if this is a Supabase Storage path or server path
                if (audioUrl.startsWith('/audio/')) {
                    // Extract the file path from server URL format: /audio/userId/filename
                    const pathParts = audioUrl.split('/');
                    if (pathParts.length >= 4) {
                        const userId = pathParts[2];
                        const filename = pathParts.slice(3).join('/');
                        const storagePath = `${userId}/${filename}`;
                        
                        // Generate signed URL from Supabase Storage
                        const { data, error } = await supabase.storage
                            .from('audio')
                            .createSignedUrl(storagePath, 3600); // 1 hour expiry
                            
                        if (error) {
                            console.error('Error creating signed URL:', error);
                            return;
                        }
                        
                        signedUrl = data.signedUrl;
                    }
                } else {
                    // If it's already a full URL, use it directly
                    signedUrl = audioUrl;
                }
                
                setCurrentAudio(signedUrl);
                
                // Update audio source and play
                if (audioRef.current && signedUrl) {
                    audioRef.current.src = signedUrl;
                    audioRef.current.load();
                    audioRef.current.play().catch(e => console.error("Audio play failed:", e));
                }
            } catch (error) {
                console.error('Error preparing audio for playback:', error);
            }
        }
    };




    const handleToggleExpand = (noteId: string) => {
        setExpandedNoteId(expandedNoteId === noteId ? null : noteId);
    };

    const sortedNotes = [...notes].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        <div style={styles.container}>
            {currentAudio && (
                <div className="card-enhanced" style={styles.playerContainer}>
                    <h3 style={styles.playerTitle}>Now Playing Note</h3>
                    <audio ref={audioRef} controls style={styles.audioPlayer} />
                </div>
            )}


            <div style={styles.timeline}>
                {sortedNotes.map((note, index) => {
                    const isExpanded = expandedNoteId === note.id;
                    const isLast = index === sortedNotes.length - 1;
                    const category = note.category || 'experience';
                    const categoryInfo = getCategoryInfo(category) || {
                        name: 'experience',
                        color: '#3b82f6',
                        backgroundColor: '#dbeafe',
                    };
                    
                    return (
                        <div key={note.id} style={styles.timelineItem}>
                            {/* Timeline line and icon */}
                            <div style={styles.timelineTrack}>
                                <div 
                                    style={{
                                        ...styles.timelineIcon,
                                        backgroundColor: categoryInfo.backgroundColor,
                                        borderColor: categoryInfo.color,
                                    }}
                                >
                                    {note.type === 'photo' ? (
                                        <ImageIcon size={8} style={{ color: categoryInfo.color }} />
                                    ) : (
                                        <User size={8} style={{ color: categoryInfo.color }} />
                                    )}
                                </div>
                                {!isLast && <div style={styles.timelineLine} />}
                            </div>

                            {/* Note content */}
                            <div style={styles.noteContent}>
                                <div 
                                    style={styles.noteHeader}
                                    onClick={() => handleToggleExpand(note.id)}
                                >
                                    <div>
                                        <h3 style={styles.noteTitle}>{note.title}</h3>
                                        <p style={styles.noteDate}>
                                            {new Date(note.date).toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric'
                                            })}
                                        </p>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div style={styles.expandedContent}>
                                        {note.type === 'audio' ? (
                                            <div>
                                                <div style={styles.transcript}>
                                                    <p style={styles.transcriptText}>{note.transcript}</p>
                                                </div>
                                                <div style={styles.audioControls}>
                                                    <button 
                                                        onClick={() => handlePlayNote(note.audioUrl!)}
                                                        style={styles.playButton}
                                                    >
                                                        <PlayCircle size={16} />
                                                        Play Audio
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <div style={styles.photoContainer}>
                                                    <div style={styles.photoPlaceholder}>
                                                        {note.imageUrl && (
                                                            <SupabaseImage
                                                                src={note.imageUrl}
                                                                alt={note.title}
                                                                style={styles.photo}
                                                            />
                                                        )}
                                                    </div>
                                                </div>
                                                <div style={styles.transcript}>
                                                    <p style={styles.transcriptText}>
                                                        {note.type === 'photo' ? (note.originalCaption || 'No caption provided') : note.transcript}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                        
                                        <div style={styles.actionButtons}>
                                            <button 
                                                onClick={() => handleDeleteNote(note.id)}
                                                style={styles.deleteButton}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                            <button style={styles.shareButton}>
                                                <Share2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
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
        paddingTop: '0.75rem',
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
    timeline: {
        position: 'relative' as const,
    },
    timelineItem: {
        display: 'flex',
        marginBottom: '0.75rem',
        position: 'relative' as const,
    },
    timelineTrack: {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        marginRight: '0.75rem',
        position: 'relative' as const,
        paddingTop: '0.125rem',
    },
    timelineIcon: {
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        border: '1.5px solid',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        flexShrink: 0,
        zIndex: 2,
    },
    timelineLine: {
        width: '1px',
        backgroundColor: '#e5e7eb',
        flex: 1,
        minHeight: '30px',
        marginTop: '0.25rem',
    },
    noteContent: {
        flex: 1,
        minWidth: 0,
    },
    noteHeader: {
        cursor: 'pointer',
        paddingBottom: '0.25rem',
    },
    noteTitle: {
        margin: 0,
        fontSize: '0.9rem',
        fontWeight: '600',
        color: 'var(--text-color)',
        fontFamily: 'var(--font-family-heading)',
        lineHeight: '1.3',
        marginBottom: '0.125rem',
    },
    noteDate: {
        margin: 0,
        fontSize: '0.75rem',
        color: 'var(--text-secondary)',
        fontFamily: 'var(--font-family)',
        fontWeight: '400',
    },
    expandedContent: {
        marginTop: '1rem',
        padding: '1rem',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
    },
    transcript: {
        marginBottom: '1rem',
    },
    transcriptText: {
        margin: 0,
        fontSize: '0.9rem',
        lineHeight: '1.6',
        color: '#374151',
    },
    audioControls: {
        marginBottom: '1rem',
    },
    playButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.75rem 1.5rem',
        backgroundColor: '#3b82f6',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '0.9rem',
        fontWeight: '500',
        transition: 'background-color 0.2s',
        fontFamily: 'var(--font-family)',
    },
    photoContainer: {
        marginBottom: '1rem',
    },
    photoPlaceholder: {
        width: '100%',
        height: '200px',
        backgroundColor: '#f3f4f6',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    photo: {
        width: '100%',
        height: '100%',
        objectFit: 'cover' as const,
    },
    actionButtons: {
        display: 'flex',
        gap: '0.75rem',
        justifyContent: 'flex-end',
    },
    deleteButton: {
        width: '40px',
        height: '40px',
        borderRadius: '8px',
        border: 'none',
        backgroundColor: '#fee2e2',
        color: '#dc2626',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s',
    },
    shareButton: {
        width: '40px',
        height: '40px',
        borderRadius: '8px',
        border: 'none',
        backgroundColor: '#e5e7eb',
        color: '#6b7280',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s',
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