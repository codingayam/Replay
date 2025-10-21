import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Lock, Save, Video, X } from 'lucide-react';
import { useResponsive } from '../hooks/useResponsive';
import { useSubscription } from '../contexts/SubscriptionContext';

interface PhotoUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpload: (files: File[], caption: string, noteDate: string) => void;
    isUploading?: boolean;
    noteDate: string;
    onDateChange: (value: string) => void;
}

const MAX_PHOTOS = 10;
const FALLBACK_CAMERA_CAPTURE_NAME = 'captured-photo.jpg';

const formatDateInput = (date: Date) => {
    const pad = (value: number) => value.toString().padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    return `${year}-${month}-${day}`;
};

const PhotoUploadModal: React.FC<PhotoUploadModalProps> = ({
    isOpen,
    onClose,
    onUpload,
    isUploading = false,
    noteDate,
    onDateChange,
}) => {
    const { isPremium, showPaywall } = useSubscription();
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);
    const [caption, setCaption] = useState('');
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [isCapturing, setIsCapturing] = useState(false);
    const [isVideoReady, setIsVideoReady] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const remainingSlots = MAX_PHOTOS - selectedFiles.length;
    const hasSelection = selectedFiles.length > 0;
    const supportsCameraApi = useMemo(() => typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia), []);
    const { isDesktop } = useResponsive();
    const allowCameraCapture = !isDesktop;
    const requirePremiumAccess = () => {
        if (isPremium) {
            return true;
        }
        showPaywall();
        return false;
    };

    useEffect(() => {
        if (!allowCameraCapture) {
            streamRef.current?.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
            setIsCameraActive(false);
            setIsCapturing(false);
            setIsVideoReady(false);
            setCameraError(null);
        }
    }, [allowCameraCapture]);

    useEffect(() => {
        return () => {
            cleanupPreviews();
            stopCameraStream();
        };
    }, []);

    useEffect(() => {
        if (!isOpen) {
            cleanupPreviews();
            stopCameraStream();
            resetFormState();
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            const parsed = noteDate ? new Date(noteDate) : null;
            if (!parsed || Number.isNaN(parsed.getTime())) {
                onDateChange(formatDateInput(new Date()));
            }
        }
    }, [isOpen, noteDate, onDateChange]);

    const cleanupPreviews = () => {
        previewUrls.forEach((url) => URL.revokeObjectURL(url));
        setPreviewUrls([]);
    };

    const stopCameraStream = () => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setIsCameraActive(false);
        setIsCapturing(false);
        setIsVideoReady(false);
    };

    const resetFormState = () => {
        setSelectedFiles([]);
        setCaption('');
        setCameraError(null);
    };

    const addFiles = (files: File[]) => {
        if (!requirePremiumAccess()) {
            return;
        }
        if (!files.length) {
            return;
        }
        const allowed = files.slice(0, remainingSlots);
        if (!allowed.length) {
            alert(`You can upload up to ${MAX_PHOTOS} photos per note.`);
            return;
        }
        const previews = allowed.map((file) => URL.createObjectURL(file));
        setSelectedFiles((prev) => [...prev, ...allowed]);
        setPreviewUrls((prev) => [...prev, ...previews]);
    };

    const handleLibrarySelect = () => {
        if (!requirePremiumAccess()) {
            return;
        }
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files ? Array.from(event.target.files) : [];
        if (files.length) {
            addFiles(files);
        }
        event.target.value = '';
    };

    const waitForVideoReady = async (video: HTMLVideoElement) => {
        if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
            setIsVideoReady(true);
            return;
        }

        await new Promise<void>((resolve) => {
            let resolved = false;
            let timeoutId: number | undefined;
            let frameRequestId: number | null = null;

            const cleanup = () => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                if (frameRequestId !== null && 'cancelVideoFrameCallback' in video) {
                    (video as any).cancelVideoFrameCallback(frameRequestId);
                }
                video.removeEventListener('loadeddata', handleReady);
                video.removeEventListener('loadedmetadata', handleReady);
            };

            const resolveReady = () => {
                if (!resolved) {
                    resolved = true;
                    cleanup();
                    resolve();
                }
            };

            const handleReady = () => {
                if (video.videoWidth > 0 && video.videoHeight > 0) {
                    resolveReady();
                }
            };

            const requestFrame = () => {
                if ('requestVideoFrameCallback' in video) {
                    frameRequestId = (video as any).requestVideoFrameCallback(() => {
                        if (video.videoWidth > 0 && video.videoHeight > 0) {
                            resolveReady();
                        } else {
                            requestFrame();
                        }
                    });
                } else {
                    const fallbackCheck = () => {
                        if (video.videoWidth > 0 && video.videoHeight > 0) {
                            resolveReady();
                        } else {
                            frameRequestId = window.requestAnimationFrame(fallbackCheck);
                        }
                    };
                    frameRequestId = window.requestAnimationFrame(fallbackCheck);
                }
            };

            video.addEventListener('loadeddata', handleReady);
            video.addEventListener('loadedmetadata', handleReady);
            requestFrame();

            timeoutId = window.setTimeout(() => {
                cleanup();
                resolveReady();
            }, 5000);
        });

        if (video.videoWidth > 0 && video.videoHeight > 0) {
            setIsVideoReady(true);
        } else {
            setCameraError('Camera stream is taking longer than expected. Please try again or use the Photo Library option.');
        }
    };

    const handleCameraTrigger = async () => {
        if (!requirePremiumAccess()) {
            return;
        }
        if (!allowCameraCapture) {
            return;
        }
        setCameraError(null);
        setIsVideoReady(false);
        if (supportsCameraApi) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                setIsCameraActive(true);
                setIsVideoReady(true);
            } catch (error) {
                console.error('Camera access error:', error);
                setCameraError('Unable to access camera. You can use the fallback capture instead.');
                triggerFallbackCamera();
            }
        } else {
            triggerFallbackCamera();
        }
    };

    const triggerFallbackCamera = () => {
        cameraInputRef.current?.click();
    };

    const handleFallbackCameraChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files ? Array.from(event.target.files) : [];
        if (files.length) {
            addFiles(files);
        }
        event.target.value = '';
    };

    const handleCaptureFrame = () => {
        if (!requirePremiumAccess()) {
            return;
        }
        if (!videoRef.current || !canvasRef.current) {
            return;
        }
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const intrinsicWidth = video.videoWidth || video.clientWidth || 1280;
        const intrinsicHeight = video.videoHeight || video.clientHeight || 720;
        if (intrinsicWidth === 0 || intrinsicHeight === 0) {
            setCameraError('Camera is still getting ready. Please try again in a moment.');
            return;
        }
        canvas.width = intrinsicWidth;
        canvas.height = intrinsicHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            setCameraError('Unable to capture image, please try again.');
            return;
        }
        const track = streamRef.current?.getVideoTracks()?.find((t) => t.readyState === 'live');
        console.table({
            source: 'PhotoUpload capture',
            readyState: video.readyState,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            clientWidth: video.clientWidth,
            clientHeight: video.clientHeight,
            trackReadyState: track?.readyState,
            trackMuted: track?.muted,
        });
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        setIsCapturing(true);
        canvas.toBlob((blob) => {
            setIsCapturing(false);
            if (!blob) {
                setCameraError('Failed to capture photo. Please try again.');
                return;
            }
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const file = new File([blob], `${timestamp}-${FALLBACK_CAMERA_CAPTURE_NAME}`, { type: blob.type || 'image/jpeg' });
            addFiles([file]);
            stopCameraStream();
        }, 'image/jpeg', 0.92);
    };

    const handleRemoveFile = (index: number) => {
        setSelectedFiles((prev) => prev.filter((_, idx) => idx !== index));
        setPreviewUrls((prev) => {
            const next = [...prev];
            const [removed] = next.splice(index, 1);
            if (removed) {
                URL.revokeObjectURL(removed);
            }
            return next;
        });
    };

    const handleUpload = () => {
        if (!requirePremiumAccess()) {
            return;
        }
        if (!hasSelection || !caption.trim() || !noteDate || isUploading) {
            return;
        }
        onUpload(selectedFiles, caption.trim(), noteDate);
        handleClose();
    };

    const handleClose = () => {
        cleanupPreviews();
        stopCameraStream();
        resetFormState();
        onClose();
    };

    if (!isOpen) {
        return null;
    }

    if (!isPremium) {
        return (
            <div style={styles.backdrop} onClick={handleClose}>
                <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                    <div style={styles.header}>
                        <h3 style={styles.title}>Upload Photos</h3>
                        <button onClick={handleClose} style={styles.closeButton}>
                            <X size={20} />
                        </button>
                    </div>
                    <div style={styles.lockedContent}>
                        <div style={styles.lockIconWrapper}>
                            <Lock size={40} />
                        </div>
                        <h4 style={styles.lockedTitle}>Unlock photo journaling</h4>
                        <p style={styles.lockedDescription}>
                            Photo-only notes are available for Replay Premium members. Upgrade to add rich visuals to your reflections.
                        </p>
                        <button type="button" style={styles.upgradeButton} onClick={() => showPaywall()}>
                            Upgrade to Premium
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.backdrop} onClick={handleClose}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div style={styles.header}>
                    <h3 style={styles.title}>Upload Photos</h3>
                    <button onClick={handleClose} style={styles.closeButton}>
                        <X size={20} />
                    </button>
                </div>

                <div style={styles.content}>
                    <div style={styles.uploadSummary}>
                        <span>{selectedFiles.length} / {MAX_PHOTOS} photos selected</span>
                        {remainingSlots === 0 && <span style={styles.limitNotice}>Maximum reached</span>}
                    </div>

                    <div style={styles.actionRow}>
                        <button type="button" style={styles.optionButton} onClick={handleLibrarySelect} disabled={remainingSlots <= 0}>
                            <ImageIcon size={18} />
                            Photo Library
                        </button>
                        {allowCameraCapture && (
                            <button type="button" style={styles.optionButton} onClick={handleCameraTrigger} disabled={remainingSlots <= 0}>
                                <Camera size={18} />
                                Camera
                            </button>
                        )}
                    </div>

                    {allowCameraCapture && cameraError && (
                        <div style={styles.errorText}>{cameraError}</div>
                    )}

                    {allowCameraCapture && isCameraActive && (
                        <div style={styles.cameraContainer}>
                            <video ref={videoRef} style={styles.videoPreview} playsInline muted />
                            <canvas ref={canvasRef} style={styles.hiddenCanvas} />
                            <div style={styles.cameraButtons}>
                    <button type="button" style={styles.secondaryButton} onClick={() => {
                        stopCameraStream();
                    }}>
                        Cancel
                    </button>
                                <button type="button" style={styles.primaryButton} onClick={handleCaptureFrame} disabled={isCapturing}>
                                    <Video size={16} />
                                    {isCapturing ? 'Capturing...' : 'Capture Photo'}
                                </button>
                            </div>
                        </div>
                    )}

                    {hasSelection && (
                        <div style={styles.previewGrid}>
                            {previewUrls.map((url, index) => (
                                <div key={`${url}-${index}`} style={styles.previewItem}>
                                    <img src={url} alt={`Preview ${index + 1}`} style={styles.previewImage} />
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveFile(index)}
                                        style={styles.removePreviewButton}
                                        aria-label={`Remove photo ${index + 1}`}
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div style={styles.dateSection}>
                        <label htmlFor="photo-note-date" style={styles.label}>Note date</label>
                        <input
                            id="photo-note-date"
                            type="date"
                            value={noteDate}
                            onChange={(event) => onDateChange(event.target.value)}
                            style={styles.dateInput}
                        />
                        <small style={styles.hint}>Choose when this experience happened</small>
                    </div>

                    <div style={styles.captionSection}>
                        <label htmlFor="caption" style={styles.label}>Your Caption</label>
                        <textarea
                            id="caption"
                            value={caption}
                            onChange={(e) => setCaption(e.target.value)}
                            placeholder="Describe what these photos capture..."
                            style={styles.textarea}
                            rows={4}
                        />
                        <small style={styles.hint}>
                            AI will analyze your photos and enhance your caption with visual details and context
                        </small>
                    </div>

                    <div style={styles.actions}>
                        <button
                            onClick={handleUpload}
                            disabled={!hasSelection || !caption.trim() || !noteDate || isUploading}
                            style={{
                                ...styles.uploadButton,
                                ...((!hasSelection || !caption.trim() || !noteDate || isUploading) ? styles.disabledButton : {}),
                            }}
                        >
                            <Save size={16} />
                            {isUploading ? 'Analyzing photos...' : 'Upload Photos'}
                        </button>
                    </div>
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                    style={styles.hiddenInput}
                />
                <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFallbackCameraChange}
                    style={styles.hiddenInput}
                />
            </div>
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    backdrop: {
        position: 'fixed',
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
        maxWidth: '540px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        border: '1px solid var(--card-border)',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.25rem',
    },
    title: {
        margin: 0,
        fontSize: '1.25rem',
        fontWeight: 600,
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
        flexDirection: 'column',
        gap: '1.25rem',
    },
    lockedContent: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '1rem',
        padding: '2rem 1rem'
    },
    lockIconWrapper: {
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--primary-color)'
    },
    lockedTitle: {
        margin: 0,
        fontSize: '1.2rem',
        fontWeight: 600,
        color: 'var(--text-color)'
    },
    lockedDescription: {
        margin: 0,
        color: '#666',
        fontSize: '0.95rem',
        maxWidth: '320px'
    },
    upgradeButton: {
        padding: '0.75rem 1.5rem',
        borderRadius: '999px',
        border: 'none',
        backgroundColor: 'var(--primary-color)',
        color: '#fff',
        fontWeight: 600,
        cursor: 'pointer',
        fontSize: '0.95rem'
    },
    uploadSummary: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '0.85rem',
        color: '#555',
    },
    limitNotice: {
        color: '#e53e3e',
        fontWeight: 600,
    },
    actionRow: {
        display: 'flex',
        gap: '0.75rem',
        flexWrap: 'wrap',
    },
    optionButton: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.55rem 0.85rem',
        borderRadius: '8px',
        border: '1px solid var(--card-border)',
        backgroundColor: 'var(--card-elevated)',
        cursor: 'pointer',
        fontSize: '0.85rem',
        color: 'var(--text-color)',
    },
    cameraContainer: {
        border: '1px solid var(--card-border)',
        borderRadius: '12px',
        padding: '0.75rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
    },
    videoPreview: {
        width: '100%',
        borderRadius: '8px',
        backgroundColor: '#111',
    },
    hiddenCanvas: {
        display: 'none',
    },
    cameraButtons: {
        display: 'flex',
        justifyContent: 'space-between',
        gap: '0.5rem',
    },
    primaryButton: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.4rem',
        padding: '0.6rem 0.75rem',
        border: 'none',
        borderRadius: '8px',
        backgroundColor: 'var(--primary-color)',
        color: '#fff',
        cursor: 'pointer',
    },
    secondaryButton: {
        flex: 1,
        padding: '0.6rem 0.75rem',
        borderRadius: '8px',
        border: '1px solid var(--card-border)',
        backgroundColor: 'transparent',
        cursor: 'pointer',
    },
    previewGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
        gap: '0.75rem',
    },
    previewItem: {
        position: 'relative',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid var(--card-border)',
    },
    previewImage: {
        width: '100%',
        height: '80px',
        objectFit: 'cover',
    },
    removePreviewButton: {
        position: 'absolute',
        top: '4px',
        right: '4px',
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        border: 'none',
        borderRadius: '50%',
        color: '#fff',
        width: '20px',
        height: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
    },
    dateSection: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
    },
    label: {
        fontSize: '0.9rem',
        fontWeight: 600,
        color: 'var(--text-color)',
    },
    dateInput: {
        padding: '0.6rem',
        borderRadius: '8px',
        border: '1px solid var(--card-border)',
        fontSize: '0.9rem',
    },
    captionSection: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
    },
    textarea: {
        padding: '0.75rem',
        border: '1px solid var(--card-border)',
        borderRadius: '8px',
        fontSize: '1rem',
        fontFamily: 'inherit',
        resize: 'vertical',
        minHeight: '110px',
    },
    hint: {
        fontSize: '0.8rem',
        color: '#666',
        fontStyle: 'italic',
    },
    errorText: {
        fontSize: '0.8rem',
        color: '#e53e3e',
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
        color: '#fff',
        cursor: 'pointer',
        fontSize: '0.9rem',
        fontWeight: 600,
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
