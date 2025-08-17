import React, { useState, useRef } from 'react';
import { Upload, StopCircle, Save, X } from 'lucide-react';
import UploadOptionsModal from './UploadOptionsModal';
import PhotoUploadModal from './PhotoUploadModal';

interface FloatingUploadButtonProps {
    onSaveAudio: (blob: Blob) => void;
    onSavePhoto: (file: File, caption: string) => void;
    isUploadingPhoto?: boolean;
}

const FloatingUploadButton: React.FC<FloatingUploadButtonProps> = ({ 
    onSaveAudio, 
    onSavePhoto,
    isUploadingPhoto = false 
}) => {
    // Audio recording states
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [showAudioControls, setShowAudioControls] = useState(false);
    const mediaRecorder = useRef<MediaRecorder | null>(null);
    const audioChunks = useRef<Blob[]>([]);

    // Modal states
    const [showOptionsModal, setShowOptionsModal] = useState(false);
    const [showPhotoModal, setShowPhotoModal] = useState(false);

    // Audio recording functions
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder.current = new MediaRecorder(stream);
            mediaRecorder.current.ondataavailable = (event) => {
                audioChunks.current.push(event.data);
            };
            mediaRecorder.current.onstop = () => {
                const blob = new Blob(audioChunks.current, { type: 'audio/wav' });
                setAudioBlob(blob);
                audioChunks.current = [];
                setShowAudioControls(true);
            };
            mediaRecorder.current.start();
            setIsRecording(true);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Could not access microphone. Please ensure permission is granted.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorder.current) {
            mediaRecorder.current.stop();
            setIsRecording(false);
        }
    };

    const handleSaveAudio = () => {
        if (audioBlob) {
            onSaveAudio(audioBlob);
            setAudioBlob(null);
            setShowAudioControls(false);
        }
    };

    const handleCancelAudio = () => {
        setAudioBlob(null);
        setShowAudioControls(false);
    };

    // Modal handlers
    const handleOpenOptions = () => {
        setShowOptionsModal(true);
    };

    const handleSelectAudio = () => {
        setShowOptionsModal(false);
        startRecording();
    };

    const handleSelectPhoto = () => {
        setShowOptionsModal(false);
        setShowPhotoModal(true);
    };

    const handleSavePhoto = (file: File, caption: string) => {
        onSavePhoto(file, caption);
        setShowPhotoModal(false);
    };

    // Show audio controls if we have a recorded audio blob
    if (showAudioControls && audioBlob) {
        return (
            <>
                <div style={styles.controlsContainer}>
                    <div style={styles.audioContainer}>
                        <audio src={URL.createObjectURL(audioBlob)} controls style={styles.audioPlayer} />
                    </div>
                    <div style={styles.actionButtons}>
                        <button onClick={handleSaveAudio} style={{...styles.actionButton, ...styles.saveButton}}>
                            <Save size={20} />
                            <span>Save</span>
                        </button>
                        <button onClick={handleCancelAudio} style={{...styles.actionButton, ...styles.cancelButton}}>
                            <X size={20} />
                            <span>Cancel</span>
                        </button>
                    </div>
                </div>
            </>
        );
    }

    // Show recording button when actively recording
    if (isRecording) {
        return (
            <button 
                onClick={stopRecording}
                style={{
                    ...styles.fab,
                    ...styles.recordingFab
                }}
            >
                <StopCircle size={24} />
                <span style={styles.fabText}>Stop</span>
            </button>
        );
    }

    // Main upload button
    return (
        <>
            <button 
                onClick={handleOpenOptions}
                style={{
                    ...styles.fab,
                    ...styles.defaultFab
                }}
            >
                <Upload size={24} />
                <span style={styles.fabText}>Upload</span>
            </button>

            <UploadOptionsModal
                isOpen={showOptionsModal}
                onClose={() => setShowOptionsModal(false)}
                onSelectAudio={handleSelectAudio}
                onSelectPhoto={handleSelectPhoto}
            />

            <PhotoUploadModal
                isOpen={showPhotoModal}
                onClose={() => setShowPhotoModal(false)}
                onUpload={handleSavePhoto}
                isUploading={isUploadingPhoto}
            />
        </>
    );
};

const styles = {
    fab: {
        position: 'fixed' as const,
        bottom: '110px', // Above the bottom navigation
        left: '50%',
        transform: 'translateX(-50%)',
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        zIndex: 999,
        boxShadow: 'var(--shadow-lg)',
        transition: 'all 0.3s ease',
    },
    defaultFab: {
        background: 'var(--gradient-primary)',
        color: 'white',
    },
    recordingFab: {
        backgroundColor: 'var(--error-color)',
        color: 'white',
        animation: 'pulse 1s infinite',
    },
    fabText: {
        fontSize: '0.7rem',
        fontWeight: '600',
        marginTop: '2px',
    },
    controlsContainer: {
        position: 'fixed' as const,
        bottom: '110px',
        left: '1rem',
        right: '1rem',
        backgroundColor: 'var(--card-background)',
        borderRadius: 'var(--border-radius)',
        padding: '1.25rem',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 999,
        border: '1px solid var(--card-border)',
    },
    audioContainer: {
        marginBottom: '1rem',
    },
    audioPlayer: {
        width: '100%',
        height: '40px',
    },
    actionButtons: {
        display: 'flex',
        gap: '0.75rem',
        justifyContent: 'center',
    },
    actionButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.75rem 1.5rem',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '0.9rem',
        fontWeight: '500',
        flex: 1,
        justifyContent: 'center',
    },
    saveButton: {
        backgroundColor: 'var(--success-color)',
        color: 'white',
    },
    cancelButton: {
        backgroundColor: 'var(--text-secondary)',
        color: 'white',
    },
};

export default FloatingUploadButton;