import React, { useState, useEffect } from 'react';
import { X, Save, Mic, Image as ImageIcon, FileText } from 'lucide-react';
import type { Note } from '../types';

interface EditExperienceModalProps {
    isOpen: boolean;
    onClose: () => void;
    note: Note;
    onSave: (noteId: string, updates: { title: string; transcript: string }) => void;
}

const EditExperienceModal: React.FC<EditExperienceModalProps> = ({
    isOpen,
    onClose,
    note,
    onSave
}) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (note) {
            setTitle(note.title || '');
            setDescription(note.transcript || '');
        }
    }, [note]);

    const handleSave = async () => {
        if (!title.trim() || !description.trim()) {
            return;
        }

        setIsSaving(true);
        try {
            await onSave(note.id, {
                title: title.trim(),
                transcript: description.trim()
            });
            onClose();
        } catch (error) {
            console.error('Error saving changes:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleClose = () => {
        setTitle(note.title || '');
        setDescription(note.transcript || '');
        onClose();
    };

    const getNoteIcon = () => {
        switch (note.type) {
            case 'photo':
                return <ImageIcon size={20} style={{ color: '#6366f1' }} />;
            case 'text':
                return <FileText size={20} style={{ color: '#6366f1' }} />;
            case 'audio':
            default:
                return <Mic size={20} style={{ color: '#6366f1' }} />;
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
    };

    if (!isOpen) return null;

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                {/* Header */}
                <div style={styles.header}>
                    <div style={styles.headerLeft}>
                        {getNoteIcon()}
                        <div>
                            <h2 style={styles.headerTitle}>Edit Experience</h2>
                            <p style={styles.headerDate}>{formatDate(note.date)}</p>
                        </div>
                    </div>
                    <button onClick={handleClose} style={styles.closeButton}>
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <div style={styles.form}>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            style={styles.input}
                            placeholder="Enter title..."
                        />
                    </div>

                    <div style={styles.formGroup}>
                        <label style={styles.label}>Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            style={styles.textarea}
                            placeholder="Share what happened, how you felt, or any insights you gained."
                            rows={6}
                        />
                    </div>
                </div>

                {/* Actions */}
                <div style={styles.actions}>
                    <button onClick={handleClose} style={styles.cancelButton}>
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={!title.trim() || !description.trim() || isSaving}
                        style={{
                            ...styles.saveButton,
                            ...((!title.trim() || !description.trim() || isSaving) ? styles.saveButtonDisabled : {})
                        }}
                    >
                        <Save size={16} />
                        {isSaving ? 'Saving...' : 'Save Changes'}
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
        backgroundColor: 'white',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '500px',
        maxHeight: '80vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column' as const,
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    },
    header: {
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        color: 'white',
        padding: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
    },
    headerTitle: {
        margin: 0,
        fontSize: '1.25rem',
        fontWeight: '600',
        color: 'white',
    },
    headerDate: {
        margin: '0.25rem 0 0 0',
        fontSize: '0.875rem',
        color: 'rgba(255, 255, 255, 0.8)',
    },
    closeButton: {
        background: 'none',
        border: 'none',
        color: 'white',
        cursor: 'pointer',
        padding: '0.5rem',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background-color 0.2s',
    },
    form: {
        padding: '2rem',
        flex: 1,
        overflow: 'auto',
    },
    formGroup: {
        marginBottom: '1.5rem',
    },
    label: {
        display: 'block',
        marginBottom: '0.5rem',
        fontSize: '1rem',
        fontWeight: '500',
        color: '#374151',
    },
    input: {
        width: '100%',
        padding: '0.75rem',
        border: '1px solid #d1d5db',
        borderRadius: '8px',
        fontSize: '1rem',
        fontFamily: 'inherit',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        outline: 'none',
        boxSizing: 'border-box' as const,
    },
    textarea: {
        width: '100%',
        padding: '0.75rem',
        border: '1px solid #d1d5db',
        borderRadius: '8px',
        fontSize: '1rem',
        fontFamily: 'inherit',
        resize: 'vertical' as const,
        minHeight: '120px',
        lineHeight: '1.5',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        outline: 'none',
        boxSizing: 'border-box' as const,
    },
    actions: {
        padding: '1.5rem 2rem',
        borderTop: '1px solid #e5e7eb',
        display: 'flex',
        gap: '1rem',
        justifyContent: 'flex-end',
    },
    cancelButton: {
        padding: '0.75rem 1.5rem',
        border: '1px solid #d1d5db',
        borderRadius: '8px',
        backgroundColor: 'white',
        color: '#374151',
        fontSize: '1rem',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'all 0.2s',
    },
    saveButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.75rem 1.5rem',
        border: 'none',
        borderRadius: '8px',
        backgroundColor: '#6366f1',
        color: 'white',
        fontSize: '1rem',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
    },
    saveButtonDisabled: {
        backgroundColor: '#9ca3af',
        cursor: 'not-allowed',
    },
};

export default EditExperienceModal;