import React, { useState, useEffect } from 'react';
import { X, Radio, Heart } from 'lucide-react';

interface ReplayModeSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectMode: (mode: 'Casual' | 'Meditative') => void;
}

const ReplayModeSelectionModal: React.FC<ReplayModeSelectionModalProps> = ({
    isOpen,
    onClose,
    onSelectMode,
}) => {
    const [isMobile, setIsMobile] = useState(() => {
        // Initialize with correct value to prevent flash
        if (typeof window !== 'undefined') {
            return window.innerWidth < 480;
        }
        return false;
    });

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 480);
        };
        
        // Set initial state
        checkMobile();
        
        window.addEventListener('resize', checkMobile);
        
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    if (!isOpen) return null;

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div style={styles.header}>
                    <h2 style={styles.title}>How do you want to replay your day?</h2>
                    <button onClick={onClose} style={styles.closeButton}>
                        <X size={24} />
                    </button>
                </div>

                <div style={styles.content}>
                    <div style={isMobile ? {...styles.optionsContainer, ...styles.optionsContainerMobile} : styles.optionsContainer}>
                        <button
                            onClick={() => onSelectMode('Casual')}
                            style={isMobile ? {...styles.optionCard, ...styles.optionCardMobile} : styles.optionCard}
                        >
                            <div style={styles.iconContainer}>
                                <div style={isMobile ? {...styles.iconCircle, ...styles.iconCircleMobile, backgroundColor: '#fef3c7'} : {...styles.iconCircle, backgroundColor: '#fef3c7'}}>
                                    <Radio size={isMobile ? 24 : 32} color="#f59e0b" />
                                </div>
                            </div>
                            <div style={styles.optionContent}>
                                <h3 style={isMobile ? {...styles.optionTitle, ...styles.optionTitleMobile} : styles.optionTitle}>Casual</h3>
                                <p style={styles.optionDescription}>Radio talk show style replay</p>
                            </div>
                        </button>

                        <button
                            onClick={() => onSelectMode('Meditative')}
                            style={isMobile ? {...styles.optionCard, ...styles.optionCardMobile} : styles.optionCard}
                        >
                            <div style={styles.iconContainer}>
                                <div style={isMobile ? {...styles.iconCircle, ...styles.iconCircleMobile, backgroundColor: '#dbeafe'} : {...styles.iconCircle, backgroundColor: '#dbeafe'}}>
                                    <Heart size={isMobile ? 24 : 32} color="#3b82f6" />
                                </div>
                            </div>
                            <div style={styles.optionContent}>
                                <h3 style={isMobile ? {...styles.optionTitle, ...styles.optionTitleMobile} : styles.optionTitle}>Meditative</h3>
                                <p style={styles.optionDescription}>Guided meditation and reflection</p>
                            </div>
                        </button>
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
        maxWidth: '480px',
        maxHeight: '90vh',
        overflowY: 'auto' as const,
        overflowX: 'hidden' as const,
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
        textAlign: 'center' as const,
        flex: 1,
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
        position: 'absolute' as const,
        right: '1.5rem',
    },
    content: {
        padding: '2rem 1.5rem',
    },
    optionsContainer: {
        display: 'flex',
        gap: '1rem',
        flexDirection: 'row' as const,
        minWidth: 0,
    },
    optionCard: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        padding: '2rem 1.5rem',
        border: '2px solid var(--card-border)',
        borderRadius: '16px',
        backgroundColor: 'transparent',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        textAlign: 'center' as const,
        minHeight: '200px',
        justifyContent: 'center',
    },
    iconContainer: {
        marginBottom: '1.5rem',
    },
    iconCircle: {
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto',
    },
    optionContent: {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        gap: '0.25rem',
    },
    optionTitle: {
        fontSize: '1.5rem',
        fontWeight: '700',
        color: 'var(--text-color)',
        margin: 0,
    },
    optionDescription: {
        fontSize: '1rem',
        color: 'var(--text-secondary)',
        margin: '0.5rem 0 0 0',
        fontWeight: '400',
    },
    
    // Mobile-specific styles
    optionsContainerMobile: {
        flexDirection: 'column' as const,
        gap: '1rem',
    },
    optionCardMobile: {
        padding: '1.5rem 1rem',
        minHeight: '160px',
        flex: 'none',
    },
    iconCircleMobile: {
        width: '64px',
        height: '64px',
    },
    optionTitleMobile: {
        fontSize: '1.25rem',
    },
};

export default ReplayModeSelectionModal;