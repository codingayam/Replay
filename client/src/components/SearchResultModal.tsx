import React, { useState, useEffect } from 'react';
import { X, PlayCircle, Mic, Camera, FileText, Trash2 } from 'lucide-react';
import type { Note } from '../types';
import { useAuthenticatedApi, getFileUrl } from '../utils/api';

interface SearchResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  noteId: string | null;
  searchQuery: string;
  onPlay?: (audioUrl: string) => void;
  onDelete?: (noteId: string) => void;
}

const SearchResultModal: React.FC<SearchResultModalProps> = ({
  isOpen,
  onClose,
  noteId,
  searchQuery,
  onPlay,
  onDelete
}) => {
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const api = useAuthenticatedApi();

  // Fetch note details when modal opens
  useEffect(() => {
    if (isOpen && noteId) {
      fetchNote();
    } else {
      setNote(null);
      setError(null);
      setActiveImageIndex(0);
    }
  }, [isOpen, noteId]);

  const fetchNote = async () => {
    if (!noteId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await api.get(`/notes/${noteId}`);
      setNote(res.data.note);
    } catch (err) {
      console.error('Error fetching note:', err);
      setError('Failed to load note details');
    } finally {
      setLoading(false);
    }
  };

  // Highlight matched text in the content
  const highlightText = (text: string, query: string) => {
    if (!text || !query) return text;
    
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    
    const parts: JSX.Element[] = [];
    let lastIndex = 0;
    let currentIndex = lowerText.indexOf(lowerQuery, 0);
    let keyCounter = 0;
    
    while (currentIndex !== -1) {
      // Add text before match
      if (currentIndex > lastIndex) {
        parts.push(
          <span key={`before-${keyCounter}`}>
            {text.substring(lastIndex, currentIndex)}
          </span>
        );
      }
      
      // Add highlighted match
      parts.push(
        <mark key={`highlight-${keyCounter}`} style={styles.highlight}>
          {text.substring(currentIndex, currentIndex + query.length)}
        </mark>
      );
      
      lastIndex = currentIndex + query.length;
      currentIndex = lowerText.indexOf(lowerQuery, lastIndex);
      keyCounter++;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(
        <span key={`after-${keyCounter}`}>
          {text.substring(lastIndex)}
        </span>
      );
    }
    
    return <>{parts}</>;
  };

  const imageList = note
    ? note.imageUrls && note.imageUrls.length > 0
      ? note.imageUrls
      : note.imageUrl
        ? [note.imageUrl]
        : []
    : [];
  const activeImage = imageList[Math.min(activeImageIndex, imageList.length - 1)] ?? imageList[0];

  useEffect(() => {
    if (note?.id && isOpen) {
      setActiveImageIndex(0);
    }
  }, [note?.id, isOpen, imageList.length]);

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric',
      year: 'numeric',
      weekday: 'long'
    });
  };


  // Handle play audio
  const handlePlayAudio = () => {
    if (note?.audioUrl && onPlay) {
      onPlay(note.audioUrl);
    }
  };

  // Handle delete note
  const handleDelete = () => {
    if (note && onDelete && window.confirm('Are you sure you want to delete this note?')) {
      onDelete(note.id);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Note Details</h2>
          <div style={styles.headerActions}>
            {onDelete && (
              <button onClick={handleDelete} style={styles.deleteButton}>
                <Trash2 size={20} />
              </button>
            )}
            <button onClick={onClose} style={styles.closeButton}>
              <X size={24} />
            </button>
          </div>
        </div>

        <div style={styles.content}>
          {loading && (
            <div style={styles.loading}>
              <div style={styles.spinner}></div>
              <p>Loading note...</p>
            </div>
          )}

          {error && (
            <div style={styles.error}>
              <p>{error}</p>
            </div>
          )}

          {note && (
            <div style={styles.noteContent}>
              {/* Note Header */}
              <div style={styles.noteHeader}>
                <h3 style={styles.noteTitle}>
                  {highlightText(note.title, searchQuery)}
                </h3>
                <div style={styles.noteMeta}>
                  <span style={styles.noteDate}>{formatDate(note.date)}</span>
                  <span style={styles.metaSeparator}>•</span>
                  <div style={styles.typeIcon}>
                    {note.type === 'audio' ? (
                      <Mic size={16} color="#3b82f6" />
                    ) : note.type === 'text' ? (
                      <FileText size={16} color="#8b5cf6" />
                    ) : (
                      <Camera size={16} color="#059669" />
                    )}
                  </div>
                </div>
              </div>

              {/* Photo Display */}
              {imageList.length > 0 && (
                <div style={styles.imageContainer}>
                  <img 
                    src={getFileUrl(activeImage)} 
                    alt={note.title}
                    style={styles.image}
                  />
                  {imageList.length > 1 && (
                    <div style={styles.thumbnailRow}>
                      {imageList.map((url, index) => (
                        <button
                          key={`${note.id}-thumb-${index}`}
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setActiveImageIndex(index);
                          }}
                          style={{
                            ...styles.thumbnailButton,
                            ...(activeImageIndex === index ? styles.activeThumbnailButton : {})
                          }}
                          aria-label={`View photo ${index + 1}`}
                        >
                          <img
                            src={getFileUrl(url)}
                            alt={`Thumbnail photo ${index + 1}`}
                            style={styles.thumbnailImage}
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Audio Player */}
              {note.type === 'audio' && note.audioUrl && (
                <div style={styles.audioSection}>
                  <button 
                    onClick={handlePlayAudio}
                    style={styles.playButton}
                  >
                    <PlayCircle size={20} />
                    Play Audio
                  </button>
                </div>
              )}

              {/* Full Transcript/Caption */}
              <div style={styles.transcriptSection}>
                <h4 style={styles.transcriptHeader}>
                  {note.type === 'audio' ? 'Transcription' : 'Caption & Description'}
                </h4>
                <div style={styles.transcriptContent}>
                  {highlightText(note.transcript, searchQuery)}
                </div>
                
                {/* Original Caption for Photos */}
                {note.type === 'photo' && note.originalCaption && (
                  <div style={styles.originalCaption}>
                    <h5 style={styles.originalCaptionHeader}>Your Original Caption:</h5>
                    <p style={styles.originalCaptionText}>
                      {highlightText(note.originalCaption, searchQuery)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const styles = {
  backdrop: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '1rem',
  },
  modal: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    maxWidth: '600px',
    width: '100%',
    maxHeight: '90vh',
    overflow: 'hidden',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1.5rem 1.5rem 0 1.5rem',
    borderBottom: '1px solid #e5e7eb',
    paddingBottom: '1rem',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: '600',
    color: '#111827',
    margin: 0,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#6b7280',
    padding: '0.5rem',
    borderRadius: '0.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s',
  },
  deleteButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#dc2626',
    padding: '0.5rem',
    borderRadius: '0.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s',
  },
  content: {
    padding: '1.5rem',
    overflow: 'auto',
    maxHeight: 'calc(90vh - 120px)',
  },
  loading: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: '2rem',
    color: '#6b7280',
  },
  spinner: {
    width: '24px',
    height: '24px',
    border: '2px solid #e5e7eb',
    borderTop: '2px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '1rem',
  },
  error: {
    padding: '2rem',
    textAlign: 'center' as const,
    color: '#dc2626',
  },
  noteContent: {
    fontSize: '0.9rem',
    lineHeight: '1.6',
  },
  noteHeader: {
    marginBottom: '1.5rem',
  },
  noteTitle: {
    fontSize: '1.25rem',
    fontWeight: '600',
    color: '#111827',
    marginBottom: '0.5rem',
  },
  noteMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.875rem',
    color: '#6b7280',
  },
  noteDate: {
    fontWeight: '500',
  },
  metaSeparator: {
    color: '#d1d5db',
  },
  typeIcon: {
    display: 'flex',
    alignItems: 'center',
  },
  categoryBadge: {
    fontSize: '0.75rem',
    fontWeight: '500',
    padding: '0.25rem 0.5rem',
    borderRadius: '9999px',
    textTransform: 'lowercase' as const,
  },
  imageContainer: {
    marginBottom: '1.5rem',
  },
  image: {
    width: '100%',
    height: 'auto',
    borderRadius: '8px',
    maxHeight: '400px',
    objectFit: 'cover' as const,
  },
  thumbnailRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0.5rem',
  },
  thumbnailButton: {
    border: '1px solid rgba(0,0,0,0.08)',
    borderRadius: '6px',
    padding: 0,
    cursor: 'pointer',
    background: '#fff',
    lineHeight: 0,
    transition: 'border-color 0.2s ease, transform 0.2s ease',
  },
  activeThumbnailButton: {
    borderColor: 'var(--primary-color)',
    transform: 'scale(1.03)',
    boxShadow: '0 0 0 2px rgba(0, 118, 255, 0.15)',
  },
  thumbnailImage: {
    width: '60px',
    height: '60px',
    borderRadius: '6px',
    objectFit: 'cover' as const,
  },
  audioSection: {
    marginBottom: '1.5rem',
  },
  playButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    background: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '0.75rem 1rem',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: '500',
    transition: 'background-color 0.2s',
  },
  transcriptSection: {
    marginBottom: '1rem',
  },
  transcriptHeader: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '0.75rem',
  },
  transcriptContent: {
    color: '#4b5563',
    lineHeight: '1.7',
    marginBottom: '1rem',
  },
  originalCaption: {
    borderTop: '1px solid #e5e7eb',
    paddingTop: '1rem',
  },
  originalCaptionHeader: {
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: '0.5rem',
  },
  originalCaptionText: {
    color: '#4b5563',
    fontStyle: 'italic' as const,
  },
  highlight: {
    backgroundColor: '#fef3c7',
    padding: '0.1rem 0.2rem',
    borderRadius: '3px',
  },
};

export default SearchResultModal;
