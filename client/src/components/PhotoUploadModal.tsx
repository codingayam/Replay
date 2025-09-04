import React, { useState, useRef } from 'react';
import { X, Camera, Image as ImageIcon, Save } from 'lucide-react';

interface PhotoUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpload: (file: File, caption: string) => void;
    isUploading?: boolean;
}

const PhotoUploadModal: React.FC<PhotoUploadModalProps> = ({
    isOpen,
    onClose,
    onUpload,
    isUploading = false,
}) => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [caption, setCaption] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
        }
    };

    const handleUpload = () => {
        if (selectedFile && caption.trim()) {
            onUpload(selectedFile, caption);
            handleClose();
        }
    };

    const handleClose = () => {
        setSelectedFile(null);
        setPreviewUrl(null);
        setCaption('');
        onClose();
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    if (!isOpen) return null;

    return (
        <div style={styles.backdrop} onClick={handleClose}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div style={styles.header}>
                    <h3 style={styles.title}>Upload Photo</h3>
                    <button onClick={handleClose} style={styles.closeButton}>
                        <X size={20} />
                    </button>
                </div>

                <div style={styles.content}>
                    {!selectedFile ? (
                        <div style={styles.uploadArea} onClick={triggerFileInput}>
                            <div style={styles.uploadIcon}>
                                <Camera size={48} />
                            </div>
                            <h4 style={styles.uploadTitle}>Select a Photo</h4>
                            <p style={styles.uploadDescription}>
                                Choose from camera or photo library
                            </p>
                            <div style={styles.uploadOptions}>
                                <div style={styles.uploadOption}>
                                    <ImageIcon size={16} />
                                    <span>Photo Library</span>
                                </div>
                                <div style={styles.uploadOption}>
                                    <Camera size={16} />
                                    <span>Camera</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={styles.previewContainer}>
                            <img src={previewUrl!} alt="Preview" style={styles.previewImage} />
                            <button onClick={() => {
                                setSelectedFile(null);
                                setPreviewUrl(null);
                            }} style={styles.changePhotoButton}>
                                Change Photo
                            </button>
                        </div>
                    )}

                    <div style={styles.captionSection}>
                        <label htmlFor="caption" style={styles.label}>
                            Your Caption
                        </label>
                        <textarea
                            id="caption"
                            value={caption}
                            onChange={(e) => setCaption(e.target.value)}
                            placeholder="Describe what this photo means to you, what you were feeling, or what happened..."
                            style={styles.textarea}
                            rows={4}
                        />
                        <small style={styles.hint}>
                            AI will analyze your photo and enhance your caption with visual details and context
                        </small>
                    </div>

                    <div style={styles.actions}>
                        <button
                            onClick={handleUpload}
                            disabled={!selectedFile || !caption.trim() || isUploading}
                            style={{
                                ...styles.uploadButton,
                                ...((!selectedFile || !caption.trim() || isUploading) ? styles.disabledButton : {})
                            }}
                        >
                            <Save size={16} />
                            {isUploading ? 'Analyzing image and generating description...' : 'Upload Photo'}
                        </button>
                    </div>
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileSelect}
                    style={styles.hiddenInput}
                />
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
        zIndex: 1001,
        padding: '1rem',
    },
    modal: {
        backgroundColor: 'var(--card-background)',
        borderRadius: '16px',
        padding: '1.5rem',
        maxWidth: '500px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto' as const,
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
    content: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '1.5rem',
    },
    uploadArea: {
        border: '2px dashed var(--card-border)',
        borderRadius: '12px',
        padding: '2rem',
        textAlign: 'center' as const,
        cursor: 'pointer',
        transition: 'border-color 0.2s ease',
    },
    uploadIcon: {
        display: 'flex',
        justifyContent: 'center',
        marginBottom: '1rem',
        color: 'var(--primary-color)',
    },
    uploadTitle: {
        margin: '0 0 0.5rem 0',
        fontSize: '1.1rem',
        fontWeight: '600',
        color: 'var(--text-color)',
    },
    uploadDescription: {
        margin: '0 0 1rem 0',
        color: '#666',
        fontSize: '0.9rem',
    },
    uploadOptions: {
        display: 'flex',
        justifyContent: 'center',
        gap: '1rem',
    },
    uploadOption: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '0.85rem',
        color: '#666',
    },
    previewContainer: {
        textAlign: 'center' as const,
    },
    previewImage: {
        maxWidth: '100%',
        maxHeight: '300px',
        borderRadius: '8px',
        marginBottom: '1rem',
        objectFit: 'cover' as const,
    },
    changePhotoButton: {
        background: 'none',
        border: '1px solid var(--card-border)',
        borderRadius: '8px',
        padding: '0.5rem 1rem',
        cursor: 'pointer',
        color: 'var(--text-color)',
        fontSize: '0.9rem',
    },
    captionSection: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '0.5rem',
    },
    label: {
        fontSize: '0.9rem',
        fontWeight: '600',
        color: 'var(--text-color)',
    },
    textarea: {
        padding: '0.75rem',
        border: '1px solid var(--card-border)',
        borderRadius: '8px',
        fontSize: '1rem',
        fontFamily: 'inherit',
        resize: 'vertical' as const,
        minHeight: '100px',
    },
    hint: {
        fontSize: '0.8rem',
        color: '#666',
        fontStyle: 'italic',
    },
    actions: {
        display: 'flex',
        justifyContent: 'flex-end',
    },
    uploadButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.75rem 1.5rem',
        border: 'none',
        borderRadius: '8px',
        backgroundColor: 'var(--primary-color)',
        color: 'white',
        cursor: 'pointer',
        fontSize: '0.9rem',
        fontWeight: '600',
        transition: 'background-color 0.2s ease',
    },
    disabledButton: {
        backgroundColor: '#ccc',
        cursor: 'not-allowed',
    },
    hiddenInput: {
        display: 'none',
    },
};

export default PhotoUploadModal;