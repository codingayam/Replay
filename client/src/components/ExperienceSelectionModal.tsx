import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, CheckCircle, Circle } from 'lucide-react';
import type { Note } from '../types';
import { useAuthenticatedApi } from '../utils/api';

interface ExperienceSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectExperiences: (selectedNoteIds: string[]) => void;
    startDate: string;
    endDate: string;
    calculateRecommendedDuration: (experienceCount: number) => number;
    reflectionType?: 'Day' | 'Night' | 'Ideas';
}

interface NotesResponse {
    availableNotes: Note[];
}

const ExperienceSelectionModal: React.FC<ExperienceSelectionModalProps> = ({
    isOpen,
    onClose,
    onSelectExperiences,
    startDate,
    endDate,
    calculateRecommendedDuration,
    reflectionType,
}) => {
    const [notesData, setNotesData] = useState<NotesResponse | null>(null);
    const api = useAuthenticatedApi();
    const apiRef = useRef(api);
    const [isLoading, setIsLoading] = useState(false);
    const isLoadingRef = useRef(false);
    const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);
    
    // Update refs when values change, but don't trigger re-renders
    useEffect(() => {
        apiRef.current = api;
    }, [api]);
    
    useEffect(() => {
        isLoadingRef.current = isLoading;
    }, [isLoading]);

    const fetchNotes = useCallback(async () => {
        if (!startDate || !endDate) return;
        
        // Prevent concurrent requests
        if (isLoadingRef.current) return;
        
        setIsLoading(true);
        setError(null);
        
        try {
            const testApiClient =
                process.env.NODE_ENV === 'test'
                    ? (globalThis as any).__REPLAY_TEST_API_CLIENT__
                    : undefined;

            const client = (testApiClient && typeof testApiClient.get === 'function')
                ? testApiClient
                : apiRef.current;

            const response = await client.get(`/notes/date-range?startDate=${startDate}&endDate=${endDate}`);
            const notes: Note[] = response.data.notes;
            
            // Filter notes by local date (to handle timezone issues)
            const getLocalDateString = (date: Date): string => {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };
            
            const filteredAvailableNotes = notes.filter(note => {
                const noteDate = new Date(note.date);
                const noteDateString = getLocalDateString(noteDate);
                const dateInRange = noteDateString >= startDate && noteDateString <= endDate;
                
                // For Ideas reflection, show all notes (category filtering removed)
                if (reflectionType === 'Ideas') {
                    return dateInRange;
                }
                
                return dateInRange;
            });
            
            setNotesData({
                availableNotes: filteredAvailableNotes
            });
            
            // Clear previous selections
            setSelectedNoteIds(new Set());
        } catch (err) {
            console.error('Error fetching notes:', err);
            setError('Failed to load experiences. Please try again.');
        } finally {
            setIsLoading(false);
        }
    }, [startDate, endDate, reflectionType]);

    useEffect(() => {
        if (isOpen && startDate && endDate) {
            fetchNotes();
        } else if (!isOpen) {
            // Clear selections when modal closes
            setSelectedNoteIds(new Set());
            setError(null);
        }
    }, [isOpen, startDate, endDate, fetchNotes]);

    const toggleNoteSelection = (noteId: string) => {
        const newSelection = new Set(selectedNoteIds);
        if (newSelection.has(noteId)) {
            newSelection.delete(noteId);
        } else {
            newSelection.add(noteId);
        }
        setSelectedNoteIds(newSelection);
    };

    const handleContinue = () => {
        if (selectedNoteIds.size === 0) {
            alert('Please select at least one experience for your reflection.');
            return;
        }
        onSelectExperiences(Array.from(selectedNoteIds));
    };

    const formatDateRange = () => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (startDate === endDate) {
            return start.toLocaleDateString();
        }
        
        return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
    };


    const getNoteTypeIcon = (note: Note) => {
        return note.type === 'audio' ? '🎙️' : '📸';
    };

    if (!isOpen) return null;

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div style={styles.header}>
                    <h2 style={styles.title}>Select Experiences</h2>
                    <button onClick={onClose} style={styles.closeButton}>
                        <X size={24} />
                    </button>
                </div>

                <div style={styles.content}>
                    {isLoading ? (
                        <div style={styles.loadingContainer}>
                            <div style={styles.loadingSpinner}>✨</div>
                            <p style={styles.loadingText}>Loading your experiences...</p>
                        </div>
                    ) : error ? (
                        <div style={styles.errorContainer}>
                            <p style={styles.errorText}>{error}</p>
                            <button onClick={fetchNotes} style={styles.retryButton}>
                                Try Again
                            </button>
                        </div>
                    ) : notesData ? (
                        <>
                            <div style={styles.infoSection}>
                                <div style={styles.sessionInfo}>
                                    <div style={styles.sessionDetail}>
                                        <strong>Period:</strong> {formatDateRange()}
                                    </div>
                                    <div style={styles.sessionDetail}>
                                        <strong>Available:</strong> {notesData.availableNotes.length} experiences
                                    </div>
                                </div>
                                
                                {selectedNoteIds.size > 0 && (
                                    <div style={styles.recommendationBox}>
                                        <span style={styles.recommendationText}>
                                            <strong>Recommended Duration:</strong> {calculateRecommendedDuration(selectedNoteIds.size)} minutes for {selectedNoteIds.size} experience{selectedNoteIds.size !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {notesData.availableNotes.length === 0 ? (
                                <div style={styles.emptyState}>
                                    <div style={styles.emptyIcon}>
                                        {reflectionType === 'Ideas' ? '💡' : '📅'}
                                    </div>
                                    <h3 style={styles.emptyTitle}>
                                        {reflectionType === 'Ideas' ? 'No ideas found' : 'No experiences found'}
                                    </h3>
                                    <p style={styles.emptyText}>
                                        {reflectionType === 'Ideas' 
                                            ? 'You don\'t have any ideas-categorized experiences for the selected date range. Try selecting a different time period or record some creative thoughts first.'
                                            : 'You don\'t have any recorded experiences for the selected date range.'
                                        }
                                    </p>
                                </div>
                            ) : (
                                <div style={styles.experiencesSection}>
                                    <div style={styles.sectionHeader}>
                                        <h3 style={styles.sectionTitle}>
                                            Experiences ({selectedNoteIds.size} selected)
                                        </h3>
                                    </div>

                                    <div style={styles.experiencesList}>
                                        {notesData.availableNotes.map((note) => {
                                            const isSelected = selectedNoteIds.has(note.id);
                                            
                                            return (
                                                <div
                                                    key={note.id}
                                                    style={{
                                                        ...styles.experienceCard,
                                                        ...(isSelected ? styles.experienceCardSelected : {}),
                                                    }}
                                                    onClick={() => toggleNoteSelection(note.id)}
                                                >
                                                    <div style={styles.experienceHeader}>
                                                        <div style={styles.experienceIcon}>
                                                            {getNoteTypeIcon(note)}
                                                        </div>
                                                        <div style={styles.experienceInfo}>
                                                            <div style={styles.experienceTitleRow}>
                                                                <h4 style={styles.experienceTitle}>
                                                                    {note.title}
                                                                </h4>
                                                            </div>
                                                            <div style={styles.experienceDate}>
                                                                {new Date(note.date).toLocaleDateString()} at {new Date(note.date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                                            </div>
                                                        </div>
                                                        <div style={styles.checkboxContainer}>
                                                            {isSelected ? (
                                                                <CheckCircle size={20} color="var(--primary-color)" />
                                                            ) : (
                                                                <Circle size={20} color="var(--card-border)" />
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div style={styles.experienceContent}>
                                                        <p style={styles.experienceTranscript}>
                                                            {(() => {
                                                                const displayText = note.type === 'photo' 
                                                                    ? (note.originalCaption || 'No caption provided') 
                                                                    : (note.transcript || '');
                                                                return displayText.length > 150
                                                                    ? `${displayText.substring(0, 150)}...`
                                                                    : displayText;
                                                            })()}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : null}
                </div>

                <div style={styles.footer}>
                    <button onClick={onClose} style={styles.cancelButton}>
                        Cancel
                    </button>
                    <button 
                        onClick={handleContinue} 
                        style={{
                            ...styles.continueButton,
                            ...(selectedNoteIds.size === 0 ? styles.continueButtonDisabled : {})
                        }}
                        disabled={selectedNoteIds.size === 0}
                    >
                        Generate Reflection ({selectedNoteIds.size})
                    </button>
                </div>
            </div>
        </div>
    );
};

const styles = {
    overlay: {
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
        backgroundColor: 'var(--card-background)',
        borderRadius: 'var(--border-radius)',
        width: '100%',
        maxWidth: '600px',
        maxHeight: '90vh',
        overflowY: 'auto' as const,
        boxShadow: 'var(--shadow-lg)',
        border: '1px solid var(--card-border)',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1.5rem 1.5rem 1rem 1.5rem',
        borderBottom: '1px solid var(--card-border)',
    },
    title: {
        margin: 0,
        fontSize: '1.25rem',
        fontWeight: '600',
        color: 'var(--text-color)',
    },
    closeButton: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: 'var(--text-secondary)',
        padding: '0.25rem',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background-color 0.2s',
    },
    content: {
        padding: '1.5rem',
    },
    loadingContainer: {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        padding: '2rem',
    },
    loadingSpinner: {
        fontSize: '2rem',
        marginBottom: '1rem',
        animation: 'pulse 1.5s infinite',
    },
    loadingText: {
        color: 'var(--text-secondary)',
        fontSize: '0.95rem',
    },
    errorContainer: {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        padding: '2rem',
    },
    errorText: {
        color: 'var(--error-color)',
        marginBottom: '1rem',
        textAlign: 'center' as const,
    },
    retryButton: {
        padding: '0.75rem 1.5rem',
        border: '2px solid var(--primary-color)',
        borderRadius: '8px',
        backgroundColor: 'transparent',
        color: 'var(--primary-color)',
        cursor: 'pointer',
        fontSize: '0.9rem',
        fontWeight: '500',
    },
    infoSection: {
        marginBottom: '1.5rem',
    },
    sessionInfo: {
        display: 'flex',
        gap: '1.5rem',
        marginBottom: '1rem',
        flexWrap: 'wrap' as const,
    },
    sessionDetail: {
        fontSize: '0.85rem',
        color: 'var(--text-secondary)',
    },
    recommendationBox: {
        padding: '0.75rem 1rem',
        backgroundColor: 'rgba(var(--primary-color-rgb), 0.05)',
        borderRadius: '8px',
        border: '1px solid rgba(var(--primary-color-rgb), 0.1)',
        marginTop: '1rem',
    },
    recommendationText: {
        fontSize: '0.9rem',
        color: 'var(--primary-color)',
        fontWeight: '500',
    },
    experiencesSection: {
        marginBottom: '1rem',
    },
    sectionHeader: {
        marginBottom: '1rem',
    },
    sectionTitle: {
        margin: 0,
        fontSize: '1rem',
        fontWeight: '600',
        color: 'var(--text-color)',
    },
    experiencesList: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '0.75rem',
        maxHeight: '400px',
        overflowY: 'auto' as const,
    },
    experienceCard: {
        padding: '1rem',
        border: '2px solid var(--card-border)',
        borderRadius: '12px',
        backgroundColor: 'transparent',
        cursor: 'pointer',
        transition: 'all 0.2s',
    },
    experienceCardSelected: {
        borderColor: 'var(--primary-color)',
        backgroundColor: 'rgba(var(--primary-color-rgb), 0.05)',
    },
    experienceHeader: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        marginBottom: '0.75rem',
    },
    experienceIcon: {
        fontSize: '1.25rem',
        flexShrink: 0,
        marginTop: '0.125rem',
    },
    experienceInfo: {
        flex: 1,
        minWidth: 0,
    },
    experienceTitleRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '0.25rem',
        flexWrap: 'wrap' as const,
    },
    experienceTitle: {
        margin: 0,
        fontSize: '0.95rem',
        fontWeight: '600',
        color: 'var(--text-color)',
        lineHeight: 1.3,
    },
    experienceDate: {
        fontSize: '0.75rem',
        color: 'var(--text-secondary)',
    },
    checkboxContainer: {
        flexShrink: 0,
        marginLeft: '0.5rem',
    },
    experienceContent: {
        paddingLeft: '2rem',
    },
    experienceTranscript: {
        margin: 0,
        fontSize: '0.85rem',
        color: 'var(--text-secondary)',
        lineHeight: 1.4,
    },
    emptyState: {
        textAlign: 'center' as const,
        padding: '2rem',
    },
    emptyIcon: {
        fontSize: '3rem',
        marginBottom: '1rem',
    },
    emptyTitle: {
        margin: '0 0 0.5rem 0',
        fontSize: '1.2rem',
        fontWeight: '600',
        color: 'var(--text-color)',
    },
    emptyText: {
        margin: 0,
        color: 'var(--text-secondary)',
        fontSize: '0.95rem',
        lineHeight: 1.5,
    },
    footer: {
        display: 'flex',
        gap: '0.75rem',
        padding: '1rem 1.5rem 1.5rem 1.5rem',
        borderTop: '1px solid var(--card-border)',
        justifyContent: 'flex-end',
    },
    cancelButton: {
        padding: '0.875rem 1.5rem',
        border: '2px solid var(--text-secondary)',
        borderRadius: '8px',
        backgroundColor: 'transparent',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        fontSize: '0.95rem',
        fontWeight: '500',
        transition: 'all 0.2s',
    },
    continueButton: {
        padding: '0.875rem 1.5rem',
        border: 'none',
        borderRadius: '8px',
        background: 'var(--gradient-primary)',
        color: 'white',
        cursor: 'pointer',
        fontSize: '0.95rem',
        fontWeight: '600',
        transition: 'all 0.2s',
    },
    continueButtonDisabled: {
        opacity: 0.5,
        cursor: 'not-allowed',
    },
};

export default ExperienceSelectionModal;
