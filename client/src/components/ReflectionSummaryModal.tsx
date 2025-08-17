import React, { useState, useEffect, useCallback } from 'react';
import { X, Sparkles, Heart, CheckCircle } from 'lucide-react';

interface ReflectionSummaryModalProps {
    isOpen: boolean;
    onClose: () => void;
    noteIds: string[];
    duration: number;
    preGeneratedSummary?: string;
}

interface SummaryResponse {
    summary: string;
    reflectedOn: number;
    duration: number;
}

const API_URL = 'http://localhost:3001/api';

const ReflectionSummaryModal: React.FC<ReflectionSummaryModalProps> = ({
    isOpen,
    onClose,
    noteIds,
    duration,
    preGeneratedSummary,
}) => {
    const [summary, setSummary] = useState<SummaryResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchSummary = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        
        try {
            const response = await fetch(`${API_URL}/reflect/summary`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    noteIds,
                    duration,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to generate summary');
            }

            const data: SummaryResponse = await response.json();
            setSummary(data);
        } catch (err) {
            console.error('Error fetching summary:', err);
            setError('Failed to generate reflection summary.');
        } finally {
            setIsLoading(false);
        }
    }, [noteIds, duration]);

    useEffect(() => {
        if (isOpen && noteIds.length > 0) {
            if (preGeneratedSummary) {
                // Use the pre-generated summary
                setSummary({
                    summary: preGeneratedSummary,
                    reflectedOn: noteIds.length,
                    duration: duration
                });
                setIsLoading(false);
                setError(null);
            } else {
                // Fetch summary from API
                fetchSummary();
            }
        }
    }, [isOpen, noteIds, preGeneratedSummary, fetchSummary, duration]);

    const handleClose = () => {
        setSummary(null);
        setError(null);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div style={styles.overlay} onClick={handleClose}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div style={styles.header}>
                    <div style={styles.headerContent}>
                        <div style={styles.completedIcon}>
                            <CheckCircle size={24} color="var(--success-color)" />
                        </div>
                        <h2 style={styles.title}>Reflection Complete</h2>
                    </div>
                    <button onClick={handleClose} style={styles.closeButton}>
                        <X size={24} />
                    </button>
                </div>

                <div style={styles.content}>
                    {isLoading ? (
                        <div style={styles.loadingContainer}>
                            <div style={styles.loadingSpinner}>
                                <Sparkles size={24} color="var(--primary-color)" />
                            </div>
                            <p style={styles.loadingText}>Generating your reflection summary...</p>
                        </div>
                    ) : error ? (
                        <div style={styles.errorContainer}>
                            <p style={styles.errorText}>{error}</p>
                            <button onClick={fetchSummary} style={styles.retryButton}>
                                Try Again
                            </button>
                        </div>
                    ) : summary ? (
                        <>
                            <div style={styles.congratsSection}>
                                <div style={styles.congratsIcon}>🌟</div>
                                <p style={styles.congratsText}>
                                    You've just completed a {summary.duration}-minute reflection on {summary.reflectedOn} meaningful experience{summary.reflectedOn !== 1 ? 's' : ''}.
                                </p>
                            </div>

                            <div style={styles.summarySection}>
                                <h3 style={styles.summaryTitle}>
                                    <Heart size={18} />
                                    Your Reflection Summary
                                </h3>
                                <div style={styles.summaryContent}>
                                    <p style={styles.summaryText}>{summary.summary}</p>
                                </div>
                            </div>

                            <div style={styles.encouragementSection}>
                                <div style={styles.encouragementBox}>
                                    <div style={styles.encouragementIcon}>💝</div>
                                    <div style={styles.encouragementText}>
                                        <p style={styles.encouragementTitle}>Well done on taking this time for yourself</p>
                                        <p style={styles.encouragementSubtext}>
                                            Regular reflection helps deepen self-awareness and brings more meaning to your daily experiences.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div style={styles.statsSection}>
                                <div style={styles.statItem}>
                                    <div style={styles.statValue}>{summary.duration}</div>
                                    <div style={styles.statLabel}>Minutes</div>
                                </div>
                                <div style={styles.statItem}>
                                    <div style={styles.statValue}>{summary.reflectedOn}</div>
                                    <div style={styles.statLabel}>Experience{summary.reflectedOn !== 1 ? 's' : ''}</div>
                                </div>
                                <div style={styles.statItem}>
                                    <div style={styles.statValue}>✓</div>
                                    <div style={styles.statLabel}>Complete</div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div style={styles.emptyState}>
                            <p style={styles.emptyText}>Unable to load summary</p>
                        </div>
                    )}
                </div>

                <div style={styles.footer}>
                    <button onClick={handleClose} style={styles.doneButton}>
                        Done
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
        maxWidth: '500px',
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
    headerContent: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
    },
    completedIcon: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
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
        animation: 'pulse 1.5s infinite',
        marginBottom: '1rem',
    },
    loadingText: {
        color: 'var(--text-secondary)',
        fontSize: '0.95rem',
        textAlign: 'center' as const,
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
    congratsSection: {
        textAlign: 'center' as const,
        marginBottom: '1.5rem',
    },
    congratsIcon: {
        fontSize: '2.5rem',
        marginBottom: '0.75rem',
    },
    congratsText: {
        margin: 0,
        fontSize: '1rem',
        color: 'var(--text-secondary)',
        lineHeight: 1.5,
    },
    summarySection: {
        marginBottom: '1.5rem',
    },
    summaryTitle: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        margin: '0 0 1rem 0',
        fontSize: '1.1rem',
        fontWeight: '600',
        color: 'var(--text-color)',
    },
    summaryContent: {
        padding: '1.25rem',
        backgroundColor: 'rgba(var(--primary-color-rgb), 0.05)',
        borderRadius: '12px',
        border: '1px solid rgba(var(--primary-color-rgb), 0.1)',
    },
    summaryText: {
        margin: 0,
        fontSize: '0.95rem',
        color: 'var(--text-color)',
        lineHeight: 1.6,
        fontStyle: 'italic',
    },
    encouragementSection: {
        marginBottom: '1.5rem',
    },
    encouragementBox: {
        display: 'flex',
        gap: '1rem',
        padding: '1.25rem',
        backgroundColor: 'rgba(var(--success-color-rgb), 0.05)',
        borderRadius: '12px',
        border: '1px solid rgba(var(--success-color-rgb), 0.1)',
    },
    encouragementIcon: {
        fontSize: '1.5rem',
        flexShrink: 0,
    },
    encouragementText: {
        flex: 1,
    },
    encouragementTitle: {
        margin: '0 0 0.5rem 0',
        fontSize: '0.95rem',
        fontWeight: '600',
        color: 'var(--text-color)',
    },
    encouragementSubtext: {
        margin: 0,
        fontSize: '0.85rem',
        color: 'var(--text-secondary)',
        lineHeight: 1.4,
    },
    statsSection: {
        display: 'flex',
        gap: '1rem',
        justifyContent: 'center',
    },
    statItem: {
        textAlign: 'center' as const,
        padding: '1rem',
        borderRadius: '8px',
        backgroundColor: 'var(--card-border)',
        minWidth: '80px',
    },
    statValue: {
        fontSize: '1.5rem',
        fontWeight: '700',
        color: 'var(--primary-color)',
        marginBottom: '0.25rem',
    },
    statLabel: {
        fontSize: '0.75rem',
        color: 'var(--text-secondary)',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.5px',
    },
    emptyState: {
        textAlign: 'center' as const,
        padding: '2rem',
    },
    emptyText: {
        color: 'var(--text-secondary)',
    },
    footer: {
        display: 'flex',
        justifyContent: 'center',
        padding: '1rem 1.5rem 1.5rem 1.5rem',
        borderTop: '1px solid var(--card-border)',
    },
    doneButton: {
        padding: '1rem 2rem',
        border: 'none',
        borderRadius: '12px',
        background: 'var(--gradient-primary)',
        color: 'white',
        cursor: 'pointer',
        fontSize: '1rem',
        fontWeight: '600',
        transition: 'all 0.2s',
        minWidth: '120px',
    },
};

export default ReflectionSummaryModal;