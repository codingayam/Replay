import React, { useState, useEffect } from 'react';
import { X, Brain, Target, Feather, Sun, Heart } from 'lucide-react';
import { MEDITATION_TYPES, type MeditationTypeSlug } from '../lib/meditationTypes';

interface MeditationSubTypeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectType: (type: MeditationTypeSlug) => void;
}

const MeditationSubTypeModal: React.FC<MeditationSubTypeModalProps> = ({
    isOpen,
    onClose,
    onSelectType,
}) => {
    const [isMobile, setIsMobile] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.innerWidth < 480;
        }
        return false;
    });

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 480);
        };
        
        checkMobile();
        window.addEventListener('resize', checkMobile);
        
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    if (!isOpen) return null;

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div style={styles.header}>
                    <h2 style={styles.title}>Choose Meditation Type</h2>
                    <button onClick={onClose} style={styles.closeButton}>
                        <X size={24} />
                    </button>
                </div>

                <div style={styles.content}>
                    <div style={isMobile ? {...styles.optionsContainer, ...styles.optionsContainerMobile} : styles.optionsContainer}>
                        {MEDITATION_TYPES.map((type) => {
                            const IconComponent = getIconComponent(type.icon);
                            return (
                                <button
                                    key={type.slug}
                                    onClick={() => onSelectType(type.slug)}
                                    style={isMobile ? {...styles.optionCard, ...styles.optionCardMobile} : styles.optionCard}
                                >
                                    <div style={isMobile ? {...styles.iconContainer, ...styles.iconContainerMobile} : styles.iconContainer}>
                                        <div
                                            style={isMobile
                                                ? {...styles.iconCircle, ...styles.iconCircleMobile, backgroundColor: type.iconBackground}
                                                : {...styles.iconCircle, backgroundColor: type.iconBackground}}
                                        >
                                            <IconComponent size={isMobile ? 24 : 32} color={type.iconColor} />
                                        </div>
                                    </div>
                                    <div style={isMobile ? {...styles.optionContent, ...styles.optionContentMobile} : styles.optionContent}>
                                        <h3 style={isMobile ? {...styles.optionTitle, ...styles.optionTitleMobile} : styles.optionTitle}>{type.label}</h3>
                                        <p style={styles.optionDescription}>
                                            {type.description}
                                            <br />
                                            <strong>Recommended:</strong> {type.recommendation}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

function getIconComponent(icon: 'brain' | 'target' | 'feather' | 'sun' | 'heart') {
    switch (icon) {
        case 'target':
            return Target;
        case 'feather':
            return Feather;
        case 'sun':
            return Sun;
        case 'heart':
            return Heart;
        case 'brain':
        default:
            return Brain;
    }
}

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
        maxWidth: '720px',
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
        gap: '1.25rem',
        flexDirection: 'row' as const,
        flexWrap: 'wrap' as const,
        minWidth: 0,
        justifyContent: 'center' as const,
        alignItems: 'stretch' as const,
    },
    optionCard: {
        flex: '1 1 30%',
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
        maxWidth: '260px',
        width: '100%',
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
        gap: '0.5rem',
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
        margin: 0,
        fontWeight: '400',
        lineHeight: 1.4,
    },
    
    // Mobile-specific styles
    optionsContainerMobile: {
        flexDirection: 'column' as const,
        gap: '1rem',
    },
    optionCardMobile: {
        flexDirection: 'row' as const,
        padding: '1.25rem',
        minHeight: 'auto',
        flex: 'none',
        width: '100%',
        maxWidth: 'none',
        alignItems: 'flex-start',
        textAlign: 'left' as const,
    },
    iconCircleMobile: {
        width: '56px',
        height: '56px',
        flexShrink: 0,
    },
    optionTitleMobile: {
        fontSize: '1.1rem',
    },
    iconContainerMobile: {
        marginBottom: 0,
        marginRight: '1rem',
    },
    optionContentMobile: {
        alignItems: 'flex-start',
        flex: 1,
    },
};

export default MeditationSubTypeModal;
