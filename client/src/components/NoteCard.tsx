
import React, { useState } from 'react';
import { PlayCircle, Trash2, Edit2, Save, X, ChevronRight } from 'lucide-react';
import type { Note } from '../types';
import { getFileUrl } from '../utils/api';

interface NoteCardProps {
    note: Note;
    onPlay: (audioUrl: string) => void;
    onDelete: (id: string) => void;
    onUpdateTranscript?: (id: string, transcript: string) => void;
}

const NoteCard: React.FC<NoteCardProps> = ({ note, onPlay, onDelete, onUpdateTranscript }) => {
    const [showDetails, setShowDetails] = useState(false);
    const [isEditingTranscript, setIsEditingTranscript] = useState(false);
    const [editedTranscript, setEditedTranscript] = useState(note.transcript);

    const isPhotoNote = note.type === 'photo';
    const isAudioNote = note.type === 'audio';

    // Debug logging for photo notes
    if (isPhotoNote) {
        console.log('NoteCard DEBUG - Photo Note:', {
            title: note.title,
            type: note.type,
            transcript: note.transcript,
            originalCaption: note.originalCaption,
            aiImageDescription: note.aiImageDescription,
            hasOriginalCaption: !!note.originalCaption
        });
    }

    // Get emoji based on note type
    const getNoteTypeEmoji = (noteType: 'audio' | 'photo') => {
        switch (noteType) {
            case 'audio': return '🎤';
            case 'photo': return '📸';
            default: return '📝';
        }
    };

    // Format date to show month and day
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
        });
    };

    const handleSaveTranscript = () => {
        if (onUpdateTranscript && editedTranscript.trim() !== note.transcript) {
            onUpdateTranscript(note.id, editedTranscript.trim());
        }
        setIsEditingTranscript(false);
    };

    const handleCancelEdit = () => {
        setEditedTranscript(note.transcript);
        setIsEditingTranscript(false);
    };

    return (
        <div style={styles.listItem} onClick={() => setShowDetails(!showDetails)}>
            <div style={styles.listItemContent}>
                <div style={styles.emojiIcon}>
                    {getNoteTypeEmoji(note.type)}
                </div>
                <div style={styles.textContent}>
                    <h3 style={styles.title}>{note.title}</h3>
                    <p style={styles.date}>{formatDate(note.date)}</p>
                </div>
                <ChevronRight 
                    size={16} 
                    style={{
                        ...styles.chevron,
                        transform: showDetails ? 'rotate(90deg)' : 'rotate(0deg)'
                    }} 
                />
            </div>
            
            {showDetails && (
                <div style={styles.detailsContainer}>
                    {/* Photo display */}
                    {isPhotoNote && note.imageUrl && (
                        <div style={styles.imageContainer}>
                            <img 
                                src={getFileUrl(note.imageUrl)} 
                                alt={note.title}
                                style={styles.image}
                            />
                        </div>
                    )}

                    {/* Transcript section */}
                    <div style={styles.transcript}>
                        <div style={styles.transcriptHeader}>
                            {isEditingTranscript ? (
                                <textarea 
                                    value={editedTranscript}
                                    onChange={(e) => setEditedTranscript(e.target.value)}
                                    style={styles.transcriptTextarea}
                                    autoFocus
                                />
                            ) : (
                                <p style={styles.transcriptText}>
                                    {isPhotoNote ? (note.originalCaption || 'No caption provided') : note.transcript}
                                </p>
                            )}
                            {isAudioNote && onUpdateTranscript && (
                                <div style={styles.transcriptControls}>
                                    {isEditingTranscript ? (
                                        <>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSaveTranscript();
                                                }}
                                                style={{...styles.transcriptButton, ...styles.saveButton}}
                                                title="Save changes"
                                            >
                                                <Save size={14} />
                                            </button>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleCancelEdit();
                                                }}
                                                style={{...styles.transcriptButton, ...styles.cancelButton}}
                                                title="Cancel editing"
                                            >
                                                <X size={14} />
                                            </button>
                                        </>
                                    ) : (
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setIsEditingTranscript(true);
                                            }}
                                            style={styles.transcriptButton}
                                            title="Edit transcript"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* Controls */}
                    <div style={styles.controls}>
                        {isAudioNote && note.audioUrl && (
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onPlay(note.audioUrl!);
                                }} 
                                style={styles.button}
                            >
                                <PlayCircle />
                                Play Audio
                            </button>
                        )}
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(note.id);
                            }} 
                            style={{...styles.button, ...styles.deleteButton}}
                        >
                            <Trash2 />
                            Delete
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const styles = {
    listItem: {
        backgroundColor: 'var(--card-background)',
        borderBottom: '1px solid #f0f0f0',
        cursor: 'pointer',
        transition: 'background-color 0.15s ease',
    },
    listItemContent: {
        display: 'flex',
        alignItems: 'center',
        padding: '1rem',
        gap: '0.75rem',
    },
    emojiIcon: {
        fontSize: '1.5rem',
        width: '2rem',
        height: '2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    textContent: {
        flex: 1,
        minWidth: 0,
    },
    title: {
        margin: 0,
        fontSize: '1rem',
        fontWeight: '500',
        color: 'var(--text-color)',
        lineHeight: '1.3',
    },
    date: {
        margin: '0.125rem 0 0 0',
        fontSize: '0.875rem',
        color: 'var(--text-secondary)',
        fontWeight: '400',
    },
    chevron: {
        color: 'var(--text-secondary)',
        transition: 'transform 0.2s ease',
        flexShrink: 0,
    },
    detailsContainer: {
        padding: '0 1rem 1rem 1rem',
        borderTop: '1px solid #f0f0f0',
        backgroundColor: '#fafafa',
    },
    imageContainer: {
        marginBottom: '1rem',
        borderRadius: '8px',
        overflow: 'hidden',
    },
    image: {
        width: '100%',
        height: '200px',
        objectFit: 'cover' as const,
        display: 'block',
    },
    transcript: {
        background: '#fff',
        padding: '1rem',
        borderRadius: '8px',
        border: '1px solid #e0e0e0',
        marginBottom: '1rem',
    },
    transcriptHeader: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
    },
    transcriptText: {
        margin: 0,
        fontSize: '0.9rem',
        lineHeight: '1.5',
        color: '#333',
        flex: 1,
    },
    transcriptTextarea: {
        flex: 1,
        fontSize: '0.9rem',
        lineHeight: '1.5',
        color: '#333',
        border: '1px solid #ddd',
        borderRadius: '4px',
        padding: '0.5rem',
        fontFamily: 'inherit',
        resize: 'vertical' as const,
        minHeight: '80px',
        background: '#fff',
    },
    transcriptControls: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '0.25rem',
        flexShrink: 0,
    },
    transcriptButton: {
        background: 'none',
        border: '1px solid #ddd',
        borderRadius: '4px',
        padding: '0.4rem',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s ease',
        color: '#666',
        backgroundColor: '#fff',
    },
    saveButton: {
        borderColor: 'var(--primary-color)',
        color: 'var(--primary-color)',
    },
    cancelButton: {
        borderColor: '#999',
        color: '#999',
    },
    controls: {
        display: 'flex',
        gap: '0.75rem',
        justifyContent: 'flex-start',
        flexWrap: 'wrap' as const,
    },
    button: {
        background: 'var(--primary-color)',
        border: 'none',
        cursor: 'pointer',
        padding: '0.75rem 1rem',
        borderRadius: '8px',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        color: 'white',
        fontSize: '0.875rem',
        fontWeight: '500',
    },
    deleteButton: {
        backgroundColor: '#dc3545',
    }
};

export default NoteCard;
