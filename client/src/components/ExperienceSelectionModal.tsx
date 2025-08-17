import React, { useState, useEffect, useCallback } from 'react';
import { X, CheckCircle, Circle, Sparkles, Info } from 'lucide-react';
import type { Note } from '../types';

interface ExperienceSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectExperiences: (selectedNoteIds: string[]) => void;
    startDate: string;
    endDate: string;
    duration: number;
}

interface SuggestionResponse {
    suggestedNotes: Note[];
    availableNotes: Note[];
    recommendedCount: number;
    duration: number;
}

const API_URL = 'http://localhost:3001/api';

const ExperienceSelectionModal: React.FC<ExperienceSelectionModalProps> = ({
    isOpen,
    onClose,
    onSelectExperiences,
    startDate,
    endDate,
    duration,
}) => {
    const [suggestions, setSuggestions] = useState<SuggestionResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);

    const fetchSuggestions = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        
        try {
            const response = await fetch(`${API_URL}/reflect/suggest`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    startDate,
                    endDate,
                    duration,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to fetch suggestions');
            }

            const data: SuggestionResponse = await response.json();
            
            // Filter notes by local date (to handle timezone issues)
            const getLocalDateString = (date: Date): string => {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };
            
            const filteredAvailableNotes = data.availableNotes.filter(note => {
                const noteDate = new Date(note.date);
                const noteDateString = getLocalDateString(noteDate);
                return noteDateString >= startDate && noteDateString <= endDate;
            });
            
            const filteredSuggestedNotes = data.suggestedNotes.filter(note => {
                const noteDate = new Date(note.date);
                const noteDateString = getLocalDateString(noteDate);
                return noteDateString >= startDate && noteDateString <= endDate;
            });
            
            setSuggestions({
                ...data,
                availableNotes: filteredAvailableNotes,
                suggestedNotes: filteredSuggestedNotes
            });
            
            // Pre-select the AI suggested notes
            setSelectedNoteIds(new Set(filteredSuggestedNotes.map(note => note.id)));
        } catch (err) {
            console.error('Error fetching suggestions:', err);
            setError('Failed to load experiences. Please try again.');
        } finally {
            setIsLoading(false);
        }
    }, [startDate, endDate, duration]);

    useEffect(() => {
        if (isOpen && startDate && endDate && duration) {
            fetchSuggestions();
        }
    }, [isOpen, startDate, endDate, duration, fetchSuggestions]);

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

    const isNoteSuggested = (noteId: string) => {
        return suggestions?.suggestedNotes.some(note => note.id === noteId) || false;
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
                            <p style={styles.loadingText}>AI is selecting your most meaningful experiences...</p>
                        </div>
                    ) : error ? (
                        <div style={styles.errorContainer}>
                            <p style={styles.errorText}>{error}</p>
                            <button onClick={fetchSuggestions} style={styles.retryButton}>
                                Try Again
                            </button>
                        </div>
                    ) : suggestions ? (
                        <>
                            <div style={styles.infoSection}>
                                <div style={styles.sessionInfo}>
                                    <div style={styles.sessionDetail}>
                                        <strong>Period:</strong> {formatDateRange()}
                                    </div>
                                    <div style={styles.sessionDetail}>
                                        <strong>Duration:</strong> {duration} minutes
                                    </div>
                                    <div style={styles.sessionDetail}>
                                        <strong>Available:</strong> {suggestions.availableNotes.length} experiences
                                    </div>
                                </div>

                                {suggestions.recommendedCount && (
                                    <div style={styles.recommendationBox}>
                                        <Info size={16} />
                                        <span>
                                            We recommend selecting {suggestions.recommendedCount} experience{suggestions.recommendedCount !== 1 ? 's' : ''} for a {duration}-minute session
                                        </span>
                                    </div>
                                )}
                            </div>

                            {suggestions.availableNotes.length === 0 ? (
                                <div style={styles.emptyState}>
                                    <div style={styles.emptyIcon}>📅</div>
                                    <h3 style={styles.emptyTitle}>No experiences found</h3>
                                    <p style={styles.emptyText}>
                                        You don't have any recorded experiences for the selected date range.
                                    </p>
                                </div>
                            ) : (
                                <div style={styles.experiencesSection}>
                                    <div style={styles.sectionHeader}>
                                        <h3 style={styles.sectionTitle}>
                                            Your Experiences ({selectedNoteIds.size} selected)
                                        </h3>
                                    </div>

                                    <div style={styles.experiencesList}>
                                        {suggestions.availableNotes.map((note) => {
                                            const isSelected = selectedNoteIds.has(note.id);
                                            const isSuggested = isNoteSuggested(note.id);
                                            
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
                                                                {isSuggested && (
                                                                    <div style={styles.aiTag}>
                                                                        <Sparkles size={12} />
                                                                        <span>AI Pick</span>
                                                                    </div>
                                                                )}
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
                                                            {note.transcript.length > 150
                                                                ? `${note.transcript.substring(0, 150)}...`
                                                                : note.transcript
                                                            }
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
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.75rem 1rem',
        backgroundColor: 'rgba(var(--primary-color-rgb), 0.05)',
        borderRadius: '8px',
        border: '1px solid rgba(var(--primary-color-rgb), 0.1)',
        fontSize: '0.85rem',
        color: 'var(--text-secondary)',
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
    aiTag: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem',
        padding: '0.125rem 0.5rem',
        backgroundColor: 'var(--primary-color)',
        color: 'white',
        borderRadius: '12px',
        fontSize: '0.7rem',
        fontWeight: '600',
        flexShrink: 0,
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