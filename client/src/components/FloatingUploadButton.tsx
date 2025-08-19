import React, { useState, useRef } from 'react';
import { Upload, StopCircle, Save, X, Mic } from 'lucide-react';
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

    // Show recording interface when actively recording
    if (isRecording) {
        return (
            <div style={styles.recordingOverlay}>
                <div style={styles.recordingContainer}>
                    <div style={styles.recordingVisual}>
                        <div style={styles.pulsingCircle}>
                            <div style={styles.innerCircle}>
                                <Mic size={32} color="white" />
                            </div>
                        </div>
                        <div style={styles.waveform}>
                            {[...Array(8)].map((_, i) => (
                                <div 
                                    key={i} 
                                    style={{
                                        ...styles.waveBar,
                                        animationDelay: `${i * 0.1}s`
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                    <div style={styles.recordingInfo}>
                        <div style={styles.recordingTime}>Recording...</div>
                        <div style={styles.recordingText}>Tap to stop</div>
                    </div>
                    <button onClick={stopRecording} style={styles.stopButton}>
                        <StopCircle size={20} />
                        <span>Stop</span>
                    </button>
                </div>
            </div>
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
        bottom: '118px', // Above the bottom navigation
        right: '1.5rem',
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2px',
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
        animation: 'float-pulse 1s infinite',
    },
    fabText: {
        fontSize: '1.5rem',
        fontWeight: '400',
        lineHeight: '1',
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
    
    // New recording interface styles
    recordingOverlay: {
        position: 'fixed' as const,
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        backdropFilter: 'blur(10px)'
    },
    
    recordingContainer: {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        gap: '2rem',
        padding: '2rem',
        backgroundColor: 'var(--card-background)',
        borderRadius: '20px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
        margin: '2rem',
        minWidth: '300px'
    },
    
    recordingVisual: {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        gap: '1.5rem'
    },
    
    pulsingCircle: {
        position: 'relative' as const,
        width: '140px',
        height: '140px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #ff6b6b, #ee5a24)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'pulse 2s infinite',
        boxShadow: '0 0 40px rgba(255, 107, 107, 0.5)'
    } as React.CSSProperties,
    
    innerCircle: {
        width: '90px',
        height: '90px',
        borderRadius: '50%',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(10px)'
    },
    
    waveform: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        height: '50px'
    },
    
    waveBar: {
        width: '5px',
        backgroundColor: '#ff6b6b',
        borderRadius: '3px',
        animation: 'wave 1s infinite ease-in-out'
    } as React.CSSProperties,
    
    recordingInfo: {
        textAlign: 'center' as const,
        gap: '0.5rem'
    },
    
    recordingTime: {
        fontSize: '1.8rem',
        fontWeight: '700',
        color: '#ff6b6b',
        fontFamily: 'monospace',
        marginBottom: '0.5rem'
    },
    
    recordingText: {
        fontSize: '1.1rem',
        color: '#666',
        opacity: 0.9
    },
    
    stopButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '1rem 2rem',
        backgroundColor: '#dc3545',
        color: 'white',
        border: 'none',
        borderRadius: '30px',
        cursor: 'pointer',
        fontSize: '1.1rem',
        fontWeight: '600',
        transition: 'all 0.2s ease',
        boxShadow: '0 6px 20px rgba(220, 53, 69, 0.4)',
        minWidth: '120px',
        justifyContent: 'center'
    } as React.CSSProperties,
};

export default FloatingUploadButton;