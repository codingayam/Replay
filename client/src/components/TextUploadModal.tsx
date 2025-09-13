import React, { useState, useRef } from 'react';
import { X, FileText, Image as ImageIcon, Save, Plus } from 'lucide-react';

interface TextUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpload: (title: string, content: string, image?: File) => void;
    isUploading?: boolean;
}

const TextUploadModal: React.FC<TextUploadModalProps> = ({
    isOpen,
    onClose,
    onUpload,
    isUploading = false,
}) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [showImageUpload, setShowImageUpload] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setSelectedImage(file);
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
        }
    };

    const handleUpload = () => {
        if (title.trim() && content.trim()) {
            onUpload(title.trim(), content.trim(), selectedImage || undefined);
            handleClose();
        }
    };

    const handleClose = () => {
        setTitle('');
        setContent('');
        setSelectedImage(null);
        setPreviewUrl(null);
        setShowImageUpload(false);
        onClose();
    };

    const removeImage = () => {
        setSelectedImage(null);
        setPreviewUrl(null);
        setShowImageUpload(false);
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    const isValid = title.trim().length > 0 && content.trim().length >= 10 && content.trim().length <= 5000 && title.trim().length <= 100;

    if (!isOpen) return null;

    return (
        <div style={styles.backdrop} onClick={handleClose}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div style={styles.header}>
                    <h3 style={styles.title}>Write Journal Entry</h3>
                    <button onClick={handleClose} style={styles.closeButton}>
                        <X size={20} />
                    </button>
                </div>

                <div style={styles.content}>
                    {/* Title Section */}
                    <div style={styles.titleSection}>
                        <label htmlFor="title" style={styles.label}>
                            Title <span style={styles.required}>*</span>
                        </label>
                        <input
                            id="title"
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Enter a title for your journal entry..."
                            style={{
                                ...styles.input,
                                ...(title.length > 100 ? styles.inputError : {})
                            }}
                            maxLength={100}
                        />
                        <div style={styles.charCount}>
                            <span style={{color: title.length > 100 ? '#e53e3e' : '#666'}}>
                                {title.length}/100
                            </span>
                        </div>
                    </div>

                    {/* Content Section */}
                    <div style={styles.contentSection}>
                        <label htmlFor="content" style={styles.label}>
                            Your Journal Entry <span style={styles.required}>*</span>
                        </label>
                        <textarea
                            id="content"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Write about your thoughts, feelings, experiences, reflections, or anything that's on your mind..."
                            style={{
                                ...styles.textarea,
                                ...(content.length < 10 || content.length > 5000 ? styles.inputError : {})
                            }}
                            rows={8}
                        />
                        <div style={styles.charCount}>
                            <span style={{color: content.length < 10 || content.length > 5000 ? '#e53e3e' : '#666'}}>
                                {content.length}/5000 (min: 10 characters)
                            </span>
                        </div>
                        {content.length < 10 && content.length > 0 && (
                            <small style={styles.errorHint}>
                                Please write at least 10 characters
                            </small>
                        )}
                    </div>

                    {/* Optional Image Section */}
                    <div style={styles.imageSection}>
                        {!showImageUpload && !selectedImage ? (
                            <button
                                onClick={() => setShowImageUpload(true)}
                                style={styles.addImageButton}
                                type="button"
                            >
                                <Plus size={16} />
                                Add Photo (Optional)
                            </button>
                        ) : (
                            <div style={styles.imageContainer}>
                                <label style={styles.label}>
                                    Attach Photo (Optional)
                                </label>
                                
                                {!selectedImage ? (
                                    <div style={styles.imageUploadArea} onClick={triggerFileInput}>
                                        <div style={styles.imageUploadIcon}>
                                            <ImageIcon size={32} />
                                        </div>
                                        <p style={styles.imageUploadText}>
                                            Tap to select a photo
                                        </p>
                                    </div>
                                ) : (
                                    <div style={styles.imagePreview}>
                                        <img src={previewUrl!} alt="Preview" style={styles.previewImage} />
                                        <div style={styles.imageActions}>
                                            <button onClick={triggerFileInput} style={styles.changeImageButton}>
                                                Change Photo
                                            </button>
                                            <button onClick={removeImage} style={styles.removeImageButton}>
                                                Remove
                                            </button>
                                        </div>
                                    </div>
                                )}
                                
                                <small style={styles.hint}>
                                    Photos will be analyzed by AI to enhance your journal entry
                                </small>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div style={styles.actions}>
                        <button
                            onClick={handleUpload}
                            disabled={!isValid || isUploading}
                            style={{
                                ...styles.uploadButton,
                                ...(!isValid || isUploading ? styles.disabledButton : {})
                            }}
                        >
                            <Save size={16} />
                            {isUploading ? 'Saving your entry...' : 'Save Entry'}
                        </button>
                    </div>
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
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
        maxWidth: '600px',
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
    titleSection: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '0.5rem',
    },
    contentSection: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '0.5rem',
    },
    imageSection: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '0.5rem',
    },
    label: {
        fontSize: '0.9rem',
        fontWeight: '600',
        color: 'var(--text-color)',
    },
    required: {
        color: '#e53e3e',
    },
    input: {
        padding: '0.75rem',
        border: '1px solid var(--card-border)',
        borderRadius: '8px',
        fontSize: '1rem',
        fontFamily: 'inherit',
    },
    textarea: {
        padding: '0.75rem',
        border: '1px solid var(--card-border)',
        borderRadius: '8px',
        fontSize: '1rem',
        fontFamily: 'inherit',
        resize: 'vertical' as const,
        minHeight: '200px',
    },
    inputError: {
        borderColor: '#e53e3e',
    },
    charCount: {
        display: 'flex',
        justifyContent: 'flex-end',
        fontSize: '0.8rem',
    },
    errorHint: {
        fontSize: '0.8rem',
        color: '#e53e3e',
    },
    hint: {
        fontSize: '0.8rem',
        color: '#666',
        fontStyle: 'italic',
    },
    addImageButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.75rem 1rem',
        border: '1px dashed var(--card-border)',
        borderRadius: '8px',
        backgroundColor: 'transparent',
        color: 'var(--primary-color)',
        cursor: 'pointer',
        fontSize: '0.9rem',
        fontWeight: '500',
        transition: 'all 0.2s ease',
    },
    imageContainer: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '0.5rem',
    },
    imageUploadArea: {
        border: '1px dashed var(--card-border)',
        borderRadius: '8px',
        padding: '1.5rem',
        textAlign: 'center' as const,
        cursor: 'pointer',
        transition: 'border-color 0.2s ease',
    },
    imageUploadIcon: {
        display: 'flex',
        justifyContent: 'center',
        marginBottom: '0.5rem',
        color: 'var(--primary-color)',
    },
    imageUploadText: {
        margin: 0,
        color: '#666',
        fontSize: '0.9rem',
    },
    imagePreview: {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        gap: '0.5rem',
    },
    previewImage: {
        maxWidth: '100%',
        maxHeight: '200px',
        borderRadius: '8px',
        objectFit: 'cover' as const,
    },
    imageActions: {
        display: 'flex',
        gap: '0.5rem',
    },
    changeImageButton: {
        background: 'none',
        border: '1px solid var(--card-border)',
        borderRadius: '6px',
        padding: '0.5rem 0.75rem',
        cursor: 'pointer',
        color: 'var(--text-color)',
        fontSize: '0.8rem',
    },
    removeImageButton: {
        background: 'none',
        border: '1px solid #e53e3e',
        borderRadius: '6px',
        padding: '0.5rem 0.75rem',
        cursor: 'pointer',
        color: '#e53e3e',
        fontSize: '0.8rem',
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

export default TextUploadModal;