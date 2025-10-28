import React from 'react';
import { X, CheckCircle, ArrowLeft } from 'lucide-react';
import { getMeditationTypeConfig, type MeditationTypeSlug } from '../lib/meditationTypes';

interface ReadyToBeginModalProps {
    isOpen: boolean;
    onClose: () => void;
    onBack: () => void;
    onStart: () => void;
    reflectionType: MeditationTypeSlug;
    period: string;
    experienceCount: number;
    duration: number;
    extraContent?: React.ReactNode;
}

const ReadyToBeginModal: React.FC<ReadyToBeginModalProps> = ({
    isOpen,
    onClose,
    onBack,
    onStart,
    reflectionType,
    period,
    experienceCount,
    duration,
    extraContent,
}) => {
    if (!isOpen) return null;

    const typeConfig = getMeditationTypeConfig(reflectionType);

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div style={styles.header}>
                    <button onClick={onBack} style={styles.backButton}>
                        <ArrowLeft size={20} />
                    </button>
                    <h2 style={styles.title}>Ready to Begin</h2>
                    <button onClick={onClose} style={styles.closeButton}>
                        <X size={24} />
                    </button>
                </div>

                <div style={styles.content}>
                    <div style={styles.iconContainer}>
                        <div style={styles.checkCircle}>
                            <CheckCircle size={40} color="white" />
                        </div>
                    </div>

                    <div style={styles.summaryContainer}>
                        <div style={styles.summaryItem}>
                            <span style={styles.summaryLabel}>Type:</span>
                            <span style={styles.summaryValue}>{typeConfig.label}</span>
                        </div>

                        <div style={styles.summaryItem}>
                            <span style={styles.summaryLabel}>Period:</span>
                            <span style={styles.summaryValue}>{period}</span>
                        </div>

                        {experienceCount > 0 && (
                            <div style={styles.summaryItem}>
                                <span style={styles.summaryLabel}>Experiences:</span>
                                <span style={styles.summaryValue}>{experienceCount} selected</span>
                            </div>
                        )}

                        <div style={styles.summaryItem}>
                            <span style={styles.summaryLabel}>Duration:</span>
                            <span style={styles.summaryValue}>{duration}min</span>
                        </div>
                    </div>

                    {extraContent && (
                        <div style={styles.extraContent}>{extraContent}</div>
                    )}

                    <button onClick={onStart} style={styles.startButton}>
                        Start Reflection
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
        maxWidth: '400px',
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
        position: 'relative' as const,
    },
    backButton: {
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
    title: {
        margin: 0,
        fontSize: '1.25rem',
        fontWeight: '600',
        color: 'var(--text-color)',
        position: 'absolute' as const,
        left: '50%',
        transform: 'translateX(-50%)',
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
        padding: '2rem 1.5rem 1.5rem 1.5rem',
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        textAlign: 'center' as const,
    },
    iconContainer: {
        marginBottom: '2rem',
    },
    checkCircle: {
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        backgroundColor: '#10b981',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto',
    },
    summaryContainer: {
        width: '100%',
        marginBottom: '2rem',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '1rem',
    },
    summaryItem: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.75rem 0',
        borderBottom: '1px solid var(--card-border)',
    },
    summaryLabel: {
        fontSize: '1rem',
        color: 'var(--text-secondary)',
        fontWeight: '500',
    },
    summaryValue: {
        fontSize: '1rem',
        color: 'var(--text-color)',
        fontWeight: '600',
    },
    extraContent: {
        width: '100%',
        marginBottom: '1.5rem',
        backgroundColor: 'rgba(59, 130, 246, 0.08)',
        borderRadius: '12px',
        padding: '0.85rem 1rem',
        color: '#1e3a8a',
        fontSize: '0.95rem',
        fontWeight: 500,
        textAlign: 'left' as const,
    },
    startButton: {
        width: '100%',
        padding: '1rem 2rem',
        border: 'none',
        borderRadius: '12px',
        background: 'var(--gradient-primary)',
        color: 'white',
        cursor: 'pointer',
        fontSize: '1.1rem',
        fontWeight: '600',
        transition: 'all 0.2s',
        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
    },
};

export default ReadyToBeginModal;
