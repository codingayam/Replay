import React, { useEffect, useState } from 'react';
import { X, Play, Save, Sparkles, Clock, Heart, Music } from 'lucide-react';

interface MeditationGenerationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPlayNow: () => void;
    onSaveLater: () => void;
    duration: number;
    noteCount: number;
    summary: string;
}

const MeditationGenerationModal: React.FC<MeditationGenerationModalProps> = ({
    isOpen,
    onClose,
    onPlayNow,
    onSaveLater,
    duration,
    noteCount,
    summary,
}) => {
    const [showContent, setShowContent] = useState(false);
    const [sparkleAnimation, setSparkleAnimation] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Trigger animations when modal opens
            setTimeout(() => setShowContent(true), 100);
            setTimeout(() => setSparkleAnimation(true), 300);
        } else {
            setShowContent(false);
            setSparkleAnimation(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div 
                style={{
                    ...styles.modal,
                    ...(showContent ? styles.modalVisible : {})
                }} 
                onClick={(e) => e.stopPropagation()}
            >
                {/* Success Animation */}
                <div style={styles.successAnimation}>
                    <div style={{
                        ...styles.sparkleContainer,
                        ...(sparkleAnimation ? styles.sparkleActive : {})
                    }}>
                        <Sparkles size={48} color="var(--primary-color)" />
                    </div>
                </div>

                {/* Header */}
                <div style={styles.header}>
                    <button onClick={onClose} style={styles.closeButton}>
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div style={styles.content}>
                    <div style={styles.titleSection}>
                        <div style={styles.successIcon}>✨</div>
                        <h2 style={styles.title}>Your Reflection is Ready!</h2>
                        <p style={styles.subtitle}>
                            We've created a beautiful {duration}-minute meditation from your experiences
                        </p>
                    </div>

                    {/* Stats */}
                    <div style={styles.statsContainer}>
                        <div style={styles.statCard}>
                            <Clock size={20} color="var(--primary-color)" />
                            <div style={styles.statInfo}>
                                <div style={styles.statValue}>{duration}</div>
                                <div style={styles.statLabel}>Minutes</div>
                            </div>
                        </div>
                        <div style={styles.statCard}>
                            <Heart size={20} color="var(--primary-color)" />
                            <div style={styles.statInfo}>
                                <div style={styles.statValue}>{noteCount}</div>
                                <div style={styles.statLabel}>Experience{noteCount !== 1 ? 's' : ''}</div>
                            </div>
                        </div>
                        <div style={styles.statCard}>
                            <Music size={20} color="var(--primary-color)" />
                            <div style={styles.statInfo}>
                                <div style={styles.statValue}>Ready</div>
                                <div style={styles.statLabel}>To Play</div>
                            </div>
                        </div>
                    </div>

                    {/* Summary Preview */}
                    {summary && (
                        <div style={styles.summarySection}>
                            <h3 style={styles.summaryTitle}>Your Reflection Theme</h3>
                            <div style={styles.summaryBox}>
                                <p style={styles.summaryText}>{summary}</p>
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div style={styles.actions}>
                        <button 
                            onClick={onPlayNow}
                            style={styles.playButton}
                            className="btn-primary"
                        >
                            <Play size={20} />
                            <span>Play Now</span>
                        </button>
                        <button 
                            onClick={onSaveLater}
                            style={styles.saveButton}
                            className="btn-secondary"
                        >
                            <Save size={20} />
                            <span>Save for Later</span>
                        </button>
                    </div>

                    {/* Encouragement */}
                    <div style={styles.encouragement}>
                        <p style={styles.encouragementText}>
                            🌟 Take a deep breath and enjoy this moment of reflection
                        </p>
                    </div>
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
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
        backdropFilter: 'blur(4px)',
    },
    modal: {
        backgroundColor: 'var(--card-background)',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '500px',
        maxHeight: '90vh',
        overflowY: 'auto' as const,
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        transform: 'scale(0.9)',
        opacity: 0,
        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    },
    modalVisible: {
        transform: 'scale(1)',
        opacity: 1,
    },
    successAnimation: {
        display: 'flex',
        justifyContent: 'center',
        paddingTop: '2rem',
        marginBottom: '-1rem',
    },
    sparkleContainer: {
        transform: 'scale(0) rotate(0deg)',
        opacity: 0,
        transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
    },
    sparkleActive: {
        transform: 'scale(1) rotate(360deg)',
        opacity: 1,
    },
    header: {
        display: 'flex',
        justifyContent: 'flex-end',
        padding: '1rem 1rem 0 1rem',
    },
    closeButton: {
        background: 'rgba(var(--text-secondary-rgb), 0.1)',
        border: 'none',
        cursor: 'pointer',
        color: 'var(--text-secondary)',
        padding: '0.5rem',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s',
    },
    content: {
        padding: '0 2rem 2rem 2rem',
    },
    titleSection: {
        textAlign: 'center' as const,
        marginBottom: '2rem',
    },
    successIcon: {
        fontSize: '3rem',
        marginBottom: '1rem',
        animation: 'pulse 2s infinite',
    },
    title: {
        margin: '0 0 0.5rem 0',
        fontSize: '1.75rem',
        fontWeight: '700',
        color: 'var(--text-color)',
        background: 'var(--gradient-primary)',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
    },
    subtitle: {
        margin: 0,
        fontSize: '1rem',
        color: 'var(--text-secondary)',
        lineHeight: 1.5,
    },
    statsContainer: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '1rem',
        marginBottom: '2rem',
    },
    statCard: {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        padding: '1rem',
        backgroundColor: 'rgba(var(--primary-color-rgb), 0.05)',
        borderRadius: '12px',
        border: '1px solid rgba(var(--primary-color-rgb), 0.1)',
    },
    statInfo: {
        textAlign: 'center' as const,
        marginTop: '0.5rem',
    },
    statValue: {
        fontSize: '1.25rem',
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
    summarySection: {
        marginBottom: '2rem',
    },
    summaryTitle: {
        fontSize: '0.9rem',
        fontWeight: '600',
        color: 'var(--text-secondary)',
        marginBottom: '0.75rem',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.5px',
        textAlign: 'center' as const,
    },
    summaryBox: {
        padding: '1.25rem',
        backgroundColor: 'var(--gradient-subtle)',
        borderRadius: '12px',
        border: '1px solid var(--card-border)',
    },
    summaryText: {
        margin: 0,
        fontSize: '0.95rem',
        color: 'var(--text-color)',
        lineHeight: 1.6,
        fontStyle: 'italic',
        textAlign: 'center' as const,
    },
    actions: {
        display: 'flex',
        gap: '1rem',
        marginBottom: '1.5rem',
    },
    playButton: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        padding: '1rem',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer',
        borderRadius: '12px',
        border: 'none',
        transition: 'all 0.3s ease',
        boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)',
    },
    saveButton: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        padding: '1rem',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer',
        borderRadius: '12px',
        transition: 'all 0.3s ease',
    },
    encouragement: {
        textAlign: 'center' as const,
        padding: '1rem',
        backgroundColor: 'rgba(var(--success-color-rgb), 0.05)',
        borderRadius: '12px',
        border: '1px solid rgba(var(--success-color-rgb), 0.1)',
    },
    encouragementText: {
        margin: 0,
        fontSize: '0.9rem',
        color: 'var(--text-color)',
        lineHeight: 1.5,
    },
};

export default MeditationGenerationModal;