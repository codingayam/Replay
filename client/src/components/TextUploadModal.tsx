import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Image as ImageIcon, Plus, Save, Video, X, Camera } from 'lucide-react';
import { useResponsive } from '../hooks/useResponsive';

interface TextUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpload: (title: string, content: string, images: File[], noteDate: string) => void;
    isUploading?: boolean;
    noteDate: string;
    onDateChange: (value: string) => void;
}

const MAX_PHOTOS = 10;

const formatDateInput = (date: Date) => {
    const pad = (value: number) => value.toString().padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    return `${year}-${month}-${day}`;
};

const TextUploadModal: React.FC<TextUploadModalProps> = ({
    isOpen,
    onClose,
    onUpload,
    isUploading = false,
    noteDate,
    onDateChange,
}) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [selectedImages, setSelectedImages] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);
    const [showImageUpload, setShowImageUpload] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [isCapturing, setIsCapturing] = useState(false);
    const [isVideoReady, setIsVideoReady] = useState(false);
    const libraryInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const supportsCameraApi = useMemo(() => typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia), []);
    const isMobileDevice = useMemo(() => {
        if (typeof navigator === 'undefined') {
            return false;
        }
        const ua = navigator.userAgent || navigator.vendor || '';
        if (/android|iphone|ipad|ipod|iemobile|opera mini/i.test(ua)) {
            return true;
        }
        if (typeof window !== 'undefined' && window.matchMedia) {
            try {
                return window.matchMedia('(pointer:coarse)').matches;
            } catch (error) {
                console.warn('Pointer media query check failed:', error);
            }
        }
        return false;
    }, []);
    const { isDesktop } = useResponsive();
    const allowCameraCapture = !isDesktop;
    const remainingSlots = MAX_PHOTOS - selectedImages.length;
    const isValid = title.trim().length > 0
        && content.trim().length >= 10
        && content.trim().length <= 5000
        && title.trim().length <= 100
        && Boolean(noteDate);

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
            resetForm();
        }
    }, [isOpen]);

    useEffect(() => {
        if (!allowCameraCapture) {
            stopCameraStream();
            setCameraError(null);
        }
    }, [allowCameraCapture]);

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
    };

    const resetForm = () => {
        setTitle('');
        setContent('');
        setSelectedImages([]);
        setPreviewUrls([]);
        setShowImageUpload(false);
        setCameraError(null);
    };

    const stopCameraStream = () => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setIsCameraActive(false);
        setIsCapturing(false);
        setIsVideoReady(false);
    };

    const addImages = (files: File[]) => {
        if (!files.length) {
            return;
        }
        const allowed = files.slice(0, remainingSlots);
        if (!allowed.length) {
            alert(`You can attach up to ${MAX_PHOTOS} photos per note.`);
            return;
        }
        const previews = allowed.map((file) => URL.createObjectURL(file));
        setSelectedImages((prev) => [...prev, ...allowed]);
        setPreviewUrls((prev) => [...prev, ...previews]);
        setShowImageUpload(true);
    };

    const triggerLibraryInput = () => {
        libraryInputRef.current?.click();
    };

    const handleLibrarySelected = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files ? Array.from(event.target.files) : [];
        addImages(files);
        event.target.value = '';
    };

    const triggerCamera = async () => {
        if (!allowCameraCapture) {
            return;
        }
        setCameraError(null);
        if (isMobileDevice) {
            stopCameraStream();
            cameraInputRef.current?.click();
            return;
        }
        if (!supportsCameraApi) {
            cameraInputRef.current?.click();
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
            setIsCameraActive(true);
            setIsVideoReady(true);
        } catch (error) {
            console.error('Camera error:', error);
            setCameraError('Unable to access the camera on this device.');
            cameraInputRef.current?.click();
        }
    };

    const handleFallbackCamera = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files ? Array.from(event.target.files) : [];
        addImages(files);
        event.target.value = '';
    };

    const handleCapturePhoto = () => {
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
            setCameraError('Unable to capture image.');
            return;
        }
        const track = streamRef.current?.getVideoTracks()?.find((t) => t.readyState === 'live');
        console.table({
            source: 'TextUpload capture',
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
                setCameraError('Capturing photo failed.');
                return;
            }
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const file = new File([blob], `${timestamp}-captured-photo.jpg`, { type: blob.type || 'image/jpeg' });
            addImages([file]);
            stopCameraStream();
        }, 'image/jpeg', 0.92);
    };

    const removeImage = (index: number) => {
        setSelectedImages((prev) => prev.filter((_, idx) => idx !== index));
        setPreviewUrls((prev) => {
            const next = [...prev];
            const [removed] = next.splice(index, 1);
            if (removed) {
                URL.revokeObjectURL(removed);
            }
            return next;
        });
        if (selectedImages.length <= 1) {
            setShowImageUpload(false);
        }
    };

    const clearImages = () => {
        cleanupPreviews();
        setSelectedImages([]);
        setPreviewUrls([]);
        setShowImageUpload(false);
    };

    const handleUpload = () => {
        if (!isValid || isUploading) {
            return;
        }
        onUpload(title.trim(), content.trim(), selectedImages, noteDate);
        handleClose();
    };

    const handleClose = () => {
        cleanupPreviews();
        stopCameraStream();
        resetForm();
        onClose();
    };

    if (!isOpen) {
        return null;
    }

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
                            <span style={{ color: title.length > 100 ? '#e53e3e' : '#666' }}>
                                {title.length}/100
                            </span>
                        </div>
                    </div>

                    <div style={styles.dateSection}>
                        <label htmlFor="text-note-date" style={styles.label}>Note date <span style={styles.required}>*</span></label>
                        <input
                            id="text-note-date"
                            type="date"
                            value={noteDate}
                            onChange={(event) => onDateChange(event.target.value)}
                            style={styles.input}
                        />
                    </div>

                    <div style={styles.contentSection}>
                        <label htmlFor="content" style={styles.label}>
                            Your Journal Entry <span style={styles.required}>*</span>
                        </label>
                        <textarea
                            id="content"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Write about your thoughts, feelings, experiences, reflections..."
                            style={{
                                ...styles.textarea,
                                ...(content.length < 10 || content.length > 5000 ? styles.inputError : {})
                            }}
                            rows={8}
                        />
                        <div style={styles.charCount}>
                            <span style={{ color: content.length < 10 || content.length > 5000 ? '#e53e3e' : '#666' }}>
                                {content.length}/5000 (min: 10 characters)
                            </span>
                        </div>
                        {content.length < 10 && content.length > 0 && (
                            <small style={styles.errorHint}>Please write at least 10 characters</small>
                        )}
                    </div>

                    <div style={styles.imageSection}>
                        {!showImageUpload && selectedImages.length === 0 ? (
                            <button onClick={() => setShowImageUpload(true)} style={styles.addImageButton} type="button">
                                <Plus size={16} />
                                Add Photos (Optional)
                            </button>
                        ) : (
                            <div style={styles.imageContainer}>
                                <label style={styles.label}>Attach Photos (Optional)</label>
                                <div style={styles.imageUploadMeta}>
                                    <span>{selectedImages.length} / {MAX_PHOTOS} photos selected</span>
                                    {remainingSlots === 0 && <span style={styles.limitNotice}>Maximum reached</span>}
                                </div>
                                <div style={styles.actionRow}>
                                    <button type="button" style={styles.optionButton} onClick={triggerLibraryInput} disabled={remainingSlots <= 0}>
                                        <ImageIcon size={16} />
                                        Photo Library
                                    </button>
                                    {allowCameraCapture && (
                                        <button type="button" style={styles.optionButton} onClick={triggerCamera} disabled={remainingSlots <= 0}>
                                            <Camera size={16} />
                                            Camera
                                        </button>
                                    )}
                                </div>
                                {allowCameraCapture && cameraError && <div style={styles.errorHint}>{cameraError}</div>}

                                {allowCameraCapture && isCameraActive && (
                                    <div style={styles.cameraContainer}>
                                        <video ref={videoRef} style={styles.videoPreview} playsInline muted />
                                       <canvas ref={canvasRef} style={styles.hiddenCanvas} />
                                       <div style={styles.cameraButtons}>
                                           <button type="button" style={styles.secondaryButton} onClick={stopCameraStream}>
                                               Cancel
                                           </button>
                                            <button type="button" style={styles.primaryButton} onClick={handleCapturePhoto} disabled={isCapturing}>
                                                <Video size={16} />
                                                {isCapturing ? 'Capturing...' : 'Capture Photo'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {previewUrls.length > 0 && (
                                    <div style={styles.previewGrid}>
                                        {previewUrls.map((url, index) => (
                                            <div key={`${url}-${index}`} style={styles.previewItem}>
                                                <img src={url} alt={`Preview ${index + 1}`} style={styles.previewImage} />
                                                <button type="button" style={styles.removePreviewButton} onClick={() => removeImage(index)}>
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div style={styles.imageActionsRow}>
                                    <button onClick={triggerLibraryInput} style={styles.changeImageButton} type="button">
                                        Add More
                                    </button>
                                    {selectedImages.length > 0 && (
                                        <button onClick={clearImages} style={styles.removeImageButton} type="button">
                                            Remove All
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

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
                    ref={libraryInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleLibrarySelected}
                    style={styles.hiddenInput}
                />
                <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFallbackCamera}
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
        maxWidth: '600px',
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
        marginBottom: '1.5rem',
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
        gap: '1.5rem',
    },
    titleSection: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
    },
    contentSection: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
    },
    imageSection: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
    },
    label: {
        fontSize: '0.9rem',
        fontWeight: 600,
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
        resize: 'vertical',
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
        fontWeight: 500,
    },
    imageContainer: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
    },
    imageUploadMeta: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '0.8rem',
        color: '#555',
    },
    actionRow: {
        display: 'flex',
        gap: '0.5rem',
        flexWrap: 'wrap',
    },
    optionButton: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.5rem 0.75rem',
        borderRadius: '8px',
        border: '1px solid var(--card-border)',
        backgroundColor: 'var(--card-elevated)',
        cursor: 'pointer',
        fontSize: '0.8rem',
    },
    limitNotice: {
        color: '#e53e3e',
        fontWeight: 600,
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
        backgroundColor: '#0f172a',
    },
    hiddenCanvas: {
        display: 'none',
    },
    cameraButtons: {
        display: 'flex',
        gap: '0.5rem',
    },
    primaryButton: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.4rem',
        padding: '0.6rem 0.75rem',
        borderRadius: '8px',
        border: 'none',
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
        gap: '0.5rem',
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
        width: '18px',
        height: '18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
    },
    imageActionsRow: {
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

export default TextUploadModal;
