import React from 'react';
import { Mic, Camera, X } from 'lucide-react';

interface UploadOptionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectAudio: () => void;
    onSelectPhoto: () => void;
}

const UploadOptionsModal: React.FC<UploadOptionsModalProps> = ({
    isOpen,
    onClose,
    onSelectAudio,
    onSelectPhoto,
}) => {
    if (!isOpen) return null;

    return (
        <div style={styles.backdrop} onClick={onClose}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div style={styles.header}>
                    <h3 style={styles.title}>Choose Upload Type</h3>
                    <button onClick={onClose} style={styles.closeButton}>
                        <X size={20} />
                    </button>
                </div>
                
                <div style={styles.options}>
                    <button onClick={onSelectAudio} style={styles.optionButton}>
                        <div style={styles.optionIcon}>
                            <Mic size={32} />
                        </div>
                        <div style={styles.optionContent}>
                            <h4 style={styles.optionTitle}>Record Voice Note</h4>
                            <p style={styles.optionDescription}>
                                Record audio that will be transcribed and titled automatically
                            </p>
                        </div>
                    </button>
                    
                    <button onClick={onSelectPhoto} style={styles.optionButton}>
                        <div style={styles.optionIcon}>
                            <Camera size={32} />
                        </div>
                        <div style={styles.optionContent}>
                            <h4 style={styles.optionTitle}>Upload Photo</h4>
                            <p style={styles.optionDescription}>
                                Upload a photo with your caption for AI-enhanced journaling
                            </p>
                        </div>
                    </button>
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
        backgroundColor: 'var(--card-background)',
        borderRadius: '16px',
        padding: '1.5rem',
        maxWidth: '400px',
        width: '100%',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        border: '1px solid var(--card-border)',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
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
        color: '#666',
        padding: '0.25rem',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    options: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '1rem',
    },
    optionButton: {
        display: 'flex',
        alignItems: 'center',
        padding: '1rem',
        border: '2px solid var(--card-border)',
        borderRadius: '12px',
        backgroundColor: 'transparent',
        cursor: 'pointer',
        textAlign: 'left' as const,
        transition: 'all 0.2s ease',
        gap: '1rem',
    },
    optionIcon: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '60px',
        height: '60px',
        borderRadius: '12px',
        backgroundColor: 'var(--primary-color)',
        color: 'white',
        flexShrink: 0,
    },
    optionContent: {
        flex: 1,
    },
    optionTitle: {
        margin: '0 0 0.5rem 0',
        fontSize: '1.1rem',
        fontWeight: '600',
        color: 'var(--text-color)',
    },
    optionDescription: {
        margin: 0,
        fontSize: '0.9rem',
        color: '#666',
        lineHeight: 1.4,
    },
};

export default UploadOptionsModal;