import React from 'react';
import { X, Sun, Moon } from 'lucide-react';

interface ReflectionTypeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectType: (type: 'Day' | 'Night') => void;
}

const ReflectionTypeModal: React.FC<ReflectionTypeModalProps> = ({
    isOpen,
    onClose,
    onSelectType,
}) => {
    if (!isOpen) return null;

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div style={styles.header}>
                    <h2 style={styles.title}>Choose Your Reflection Type</h2>
                    <button onClick={onClose} style={styles.closeButton}>
                        <X size={24} />
                    </button>
                </div>

                <div style={styles.content}>
                    <div style={styles.optionsContainer}>
                        <button
                            onClick={() => onSelectType('Day')}
                            style={styles.optionCard}
                        >
                            <div style={styles.iconContainer}>
                                <div style={{...styles.iconCircle, backgroundColor: '#fef3c7'}}>
                                    <Sun size={32} color="#f59e0b" />
                                </div>
                            </div>
                            <div style={styles.optionContent}>
                                <h3 style={styles.optionTitle}>Day</h3>
                                <h4 style={styles.optionSubtitle}>Meditation</h4>
                                <p style={styles.optionDescription}>Morning mindfulness</p>
                            </div>
                        </button>

                        <button
                            onClick={() => onSelectType('Night')}
                            style={styles.optionCard}
                        >
                            <div style={styles.iconContainer}>
                                <div style={{...styles.iconCircle, backgroundColor: '#ddd6fe'}}>
                                    <Moon size={32} color="#7c3aed" />
                                </div>
                            </div>
                            <div style={styles.optionContent}>
                                <h3 style={styles.optionTitle}>Night</h3>
                                <h4 style={styles.optionSubtitle}>Reflection</h4>
                                <p style={styles.optionDescription}>Evening review</p>
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
    optionSubtitle: {
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
};

export default ReflectionTypeModal;