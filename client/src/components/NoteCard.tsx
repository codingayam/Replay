
import React, { useState } from 'react';
import { PlayCircle, Trash2, FileText, Image as ImageIcon, Edit2, Save, X } from 'lucide-react';
import type { Note } from '../types';
import CategoryBadge from './CategoryBadge';

interface NoteCardProps {
    note: Note;
    onPlay: (audioUrl: string) => void;
    onDelete: (id: string) => void;
    onUpdateTranscript?: (id: string, transcript: string) => void;
}

const NoteCard: React.FC<NoteCardProps> = ({ note, onPlay, onDelete, onUpdateTranscript }) => {
    const [showTranscript, setShowTranscript] = useState(false);
    const [showOriginalCaption, setShowOriginalCaption] = useState(false);
    const [isEditingTranscript, setIsEditingTranscript] = useState(false);
    const [editedTranscript, setEditedTranscript] = useState(note.transcript);

    const isPhotoNote = note.type === 'photo';
    const isAudioNote = note.type === 'audio';
    const category = note.category || 'experience'; // Use AI-generated category or default

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
        <div className="card-enhanced" style={styles.card}>
            <div style={styles.content}>
                {/* Photo display */}
                {isPhotoNote && note.imageUrl && (
                    <div style={styles.imageContainer}>
                        <img 
                            src={`${note.imageUrl}`} 
                            alt={note.title}
                            style={styles.image}
                        />
                    </div>
                )}

                <div style={styles.cardHeader}>
                    <CategoryBadge category={category} style={styles.categoryBadge} />
                </div>
                
                <div style={styles.header} onClick={() => setShowTranscript(!showTranscript)}>
                    <div style={styles.titleSection}>
                        <div style={styles.titleRow}>
                            <h3 style={styles.title}>{note.title}</h3>
                            <div style={styles.noteType}>
                                {isPhotoNote ? <ImageIcon size={16} /> : <PlayCircle size={16} />}
                            </div>
                        </div>
                        <p style={styles.date}>{new Date(note.date).toLocaleString()}</p>
                    </div>
                    <FileText style={{...styles.icon, opacity: showTranscript ? 1 : 0.6}} />
                </div>

                {showTranscript && (
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
                                <p style={styles.transcriptText}>{note.transcript}</p>
                            )}
                            {isAudioNote && onUpdateTranscript && (
                                <div style={styles.transcriptControls}>
                                    {isEditingTranscript ? (
                                        <>
                                            <button 
                                                onClick={handleSaveTranscript}
                                                style={{...styles.transcriptButton, ...styles.saveButton}}
                                                title="Save changes"
                                            >
                                                <Save size={14} />
                                            </button>
                                            <button 
                                                onClick={handleCancelEdit}
                                                style={{...styles.transcriptButton, ...styles.cancelButton}}
                                                title="Cancel editing"
                                            >
                                                <X size={14} />
                                            </button>
                                        </>
                                    ) : (
                                        <button 
                                            onClick={() => setIsEditingTranscript(true)}
                                            style={styles.transcriptButton}
                                            title="Edit transcript"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                        {isPhotoNote && note.originalCaption && (
                            <div style={styles.originalCaptionSection}>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowOriginalCaption(!showOriginalCaption);
                                    }}
                                    style={styles.originalCaptionToggle}
                                >
                                    {showOriginalCaption ? 'Hide' : 'Show'} Original Caption
                                </button>
                                {showOriginalCaption && (
                                    <div style={styles.originalCaption}>
                                        <p style={styles.originalCaptionText}>"{note.originalCaption}"</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
            
            <div style={styles.controls}>
                {isAudioNote && note.audioUrl && (
                    <button onClick={() => onPlay(note.audioUrl!)} style={styles.button}>
                        <PlayCircle />
                    </button>
                )}
                <button onClick={() => onDelete(note.id)} style={{...styles.button, ...styles.deleteButton}}>
                    <Trash2 />
                </button>
            </div>
        </div>
    );
};

const styles = {
    card: { 
        display: 'flex', 
        flexDirection: 'column' as const,
        backgroundColor: 'var(--card-background)', 
        border: '1px solid var(--card-border)', 
        borderRadius: 'var(--border-radius)', 
        marginBottom: '1.25rem', 
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        '&:hover': {
            boxShadow: 'var(--shadow-md)',
            borderColor: 'var(--card-border-hover)',
            transform: 'translateY(-1px)',
        }
    },
    content: {
        flex: 1,
        padding: '1.25rem',
    },
    cardHeader: {
        display: 'flex',
        justifyContent: 'flex-start',
        marginBottom: '1rem',
    },
    categoryBadge: {
        // Additional styles will be applied from CategoryBadge component
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
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        cursor: 'pointer',
        marginBottom: '0.5rem',
        gap: '1rem',
    },
    titleSection: {
        flex: 1,
        minWidth: 0,
    },
    titleRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '0.25rem',
    },
    title: { 
        margin: 0, 
        fontSize: '1.125rem',
        fontWeight: '600',
        color: 'var(--text-color)',
        fontFamily: 'var(--font-family-heading)',
        lineHeight: '1.4',
    },
    date: { 
        margin: 0, 
        fontSize: '0.875rem', 
        color: 'var(--text-secondary)',
        fontFamily: 'var(--font-family)',
        fontWeight: '400',
    },
    noteType: {
        display: 'flex',
        alignItems: 'center',
        color: 'var(--primary-color)',
    },
    icon: {
        width: '20px',
        height: '20px',
        color: '#666',
        transition: 'opacity 0.2s',
        flexShrink: 0,
    },
    transcript: {
        background: 'var(--gradient-subtle)',
        padding: '1rem',
        borderRadius: 'var(--border-radius)',
        borderLeft: '4px solid var(--primary-color)',
        marginTop: '0.75rem',
        boxShadow: 'var(--shadow-sm)',
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
    originalCaptionSection: {
        marginTop: '0.75rem',
        paddingTop: '0.75rem',
        borderTop: '1px solid #eee',
    },
    originalCaptionToggle: {
        background: 'none',
        border: 'none',
        color: 'var(--primary-color)',
        cursor: 'pointer',
        fontSize: '0.85rem',
        fontWeight: '500',
        padding: 0,
        textDecoration: 'underline',
    },
    originalCaption: {
        marginTop: '0.5rem',
        padding: '0.5rem',
        backgroundColor: '#fff',
        borderRadius: '4px',
        border: '1px solid #e0e0e0',
    },
    originalCaptionText: {
        margin: 0,
        fontSize: '0.85rem',
        color: '#555',
        fontStyle: 'italic',
    },
    controls: { 
        display: 'flex', 
        gap: '0.75rem',
        justifyContent: 'flex-end',
        padding: '1rem 1.25rem',
        borderTop: '1px solid var(--card-border)',
        backgroundColor: 'var(--background-secondary)',
    },
    button: { 
        background: 'var(--card-background)', 
        border: '1px solid var(--card-border)', 
        cursor: 'pointer', 
        padding: '0.75rem',
        borderRadius: 'var(--border-radius-sm)',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-secondary)',
        minWidth: '44px',
        minHeight: '44px',
    },
    deleteButton: { 
        color: 'var(--error-color)',
        borderColor: 'var(--error-light)',
        backgroundColor: 'var(--error-light)',
    }
};

export default NoteCard;
