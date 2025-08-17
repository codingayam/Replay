
import React, { useState } from 'react';
import { PlayCircle, Trash2, FileText, Image as ImageIcon } from 'lucide-react';
import type { Note } from '../types';

interface NoteCardProps {
    note: Note;
    onPlay: (audioUrl: string) => void;
    onDelete: (id: string) => void;
}

const NoteCard: React.FC<NoteCardProps> = ({ note, onPlay, onDelete }) => {
    const [showTranscript, setShowTranscript] = useState(false);
    const [showOriginalCaption, setShowOriginalCaption] = useState(false);

    const isPhotoNote = note.type === 'photo';
    const isAudioNote = note.type === 'audio';

    return (
        <div className="card-enhanced" style={styles.card}>
            <div style={styles.content}>
                {/* Photo display */}
                {isPhotoNote && note.imageUrl && (
                    <div style={styles.imageContainer}>
                        <img 
                            src={`http://localhost:3001${note.imageUrl}`} 
                            alt={note.title}
                            style={styles.image}
                        />
                    </div>
                )}

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
                        <p style={styles.transcriptText}>{note.transcript}</p>
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
        marginBottom: '1rem', 
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
    },
    content: {
        flex: 1,
        padding: '1rem',
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
        fontSize: '1.1rem',
        fontWeight: '600',
        color: 'var(--text-color)',
    },
    date: { 
        margin: 0, 
        fontSize: '0.8rem', 
        color: '#6c757d' 
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
    transcriptText: {
        margin: 0,
        fontSize: '0.9rem',
        lineHeight: '1.5',
        color: '#333'
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
        gap: '0.5rem',
        justifyContent: 'flex-end',
        padding: '0.75rem 1rem',
        borderTop: '1px solid #eee',
        backgroundColor: '#fafafa',
    },
    button: { 
        background: 'none', 
        border: 'none', 
        cursor: 'pointer', 
        padding: '0.75rem',
        borderRadius: 'var(--border-radius)',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--primary-color)',
    },
    deleteButton: { 
        color: 'var(--error-color)',
    }
};

export default NoteCard;
