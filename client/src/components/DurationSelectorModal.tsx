import React, { useState } from 'react';
import { X, Clock } from 'lucide-react';

interface DurationSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectDuration: (duration: number) => void;
}

const DurationSelectorModal: React.FC<DurationSelectorModalProps> = ({
    isOpen,
    onClose,
    onSelectDuration,
}) => {
    const [selectedDuration, setSelectedDuration] = useState<number>(5);

    const durationOptions = [
        { value: 5, label: '5 minutes', description: 'Quick reflection' },
        { value: 10, label: '10 minutes', description: 'Balanced session' },
        { value: 15, label: '15 minutes', description: 'Deeper exploration' },
        { value: 20, label: '20 minutes', description: 'Extended reflection' },
    ];

    const handleContinue = () => {
        onSelectDuration(selectedDuration);
    };

    if (!isOpen) return null;

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div style={styles.header}>
                    <h2 style={styles.title}>Choose Duration</h2>
                    <button onClick={onClose} style={styles.closeButton}>
                        <X size={24} />
                    </button>
                </div>

                <div style={styles.content}>
                    <p style={styles.description}>
                        How long would you like your reflection session to be?
                    </p>

                    <div style={styles.options}>
                        {durationOptions.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => setSelectedDuration(option.value)}
                                style={{
                                    ...styles.optionButton,
                                    ...(selectedDuration === option.value ? styles.optionButtonActive : {})
                                }}
                            >
                                <div style={styles.optionIcon}>
                                    <Clock size={20} />
                                </div>
                                <div style={styles.optionContent}>
                                    <div style={styles.optionLabel}>{option.label}</div>
                                    <div style={styles.optionDescription}>{option.description}</div>
                                </div>
                                <div style={styles.radioIndicator}>
                                    <div 
                                        style={{
                                            ...styles.radioCircle,
                                            ...(selectedDuration === option.value ? styles.radioCircleActive : {})
                                        }}
                                    />
                                </div>
                            </button>
                        ))}
                    </div>

                    <div style={styles.infoBox}>
                        <div style={styles.infoIcon}>💡</div>
                        <div style={styles.infoText}>
                            Longer sessions allow for deeper exploration and more pauses for reflection.
                        </div>
                    </div>
                </div>

                <div style={styles.footer}>
                    <button onClick={onClose} style={styles.cancelButton}>
                        Cancel
                    </button>
                    <button onClick={handleContinue} style={styles.continueButton}>
                        Continue
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
    description: {
        margin: '0 0 1.5rem 0',
        color: 'var(--text-secondary)',
        fontSize: '0.9rem',
        lineHeight: 1.5,
    },
    options: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '0.75rem',
        marginBottom: '1.5rem',
    },
    optionButton: {
        display: 'flex',
        alignItems: 'center',
        padding: '1rem',
        border: '2px solid var(--card-border)',
        borderRadius: '12px',
        backgroundColor: 'transparent',
        cursor: 'pointer',
        transition: 'all 0.2s',
        textAlign: 'left' as const,
        width: '100%',
    },
    optionButtonActive: {
        borderColor: 'var(--primary-color)',
        backgroundColor: 'rgba(var(--primary-color-rgb), 0.05)',
    },
    optionIcon: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '40px',
        height: '40px',
        borderRadius: '8px',
        backgroundColor: 'var(--primary-color)',
        color: 'white',
        flexShrink: 0,
        marginRight: '1rem',
    },
    optionContent: {
        flex: 1,
    },
    optionLabel: {
        fontSize: '1rem',
        fontWeight: '600',
        color: 'var(--text-color)',
        marginBottom: '0.25rem',
    },
    optionDescription: {
        fontSize: '0.85rem',
        color: 'var(--text-secondary)',
    },
    radioIndicator: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: '1rem',
    },
    radioCircle: {
        width: '20px',
        height: '20px',
        border: '2px solid var(--card-border)',
        borderRadius: '50%',
        transition: 'all 0.2s',
    },
    radioCircleActive: {
        borderColor: 'var(--primary-color)',
        backgroundColor: 'var(--primary-color)',
        position: 'relative' as const,
    },
    infoBox: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        padding: '1rem',
        backgroundColor: 'rgba(var(--primary-color-rgb), 0.05)',
        borderRadius: '8px',
        border: '1px solid rgba(var(--primary-color-rgb), 0.1)',
    },
    infoIcon: {
        fontSize: '1.2rem',
        flexShrink: 0,
    },
    infoText: {
        fontSize: '0.85rem',
        color: 'var(--text-secondary)',
        lineHeight: 1.4,
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
};

export default DurationSelectorModal;