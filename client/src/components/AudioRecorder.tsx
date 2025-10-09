
import React, { useState, useRef, useEffect } from 'react';
import { Mic, StopCircle, Save, X } from 'lucide-react';

interface AudioRecorderProps {
    onSave: (blob: Blob) => void;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({ onSave }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorder = useRef<MediaRecorder | null>(null);
    const audioChunks = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (isRecording) {
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } else {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
            setRecordingTime(0);
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [isRecording]);

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
                console.log('AudioRecorder mimeType:', mediaRecorder.current?.mimeType || 'unknown');
                console.log('AudioRecorder blob details:', { type: blob.type, size: blob.size });
                try {
                    const tempUrl = URL.createObjectURL(blob);
                    console.log('AudioRecorder preview URL:', tempUrl);
                } catch (previewError) {
                    console.warn('AudioRecorder failed to create preview URL:', previewError);
                }
                audioChunks.current = [];
                stream.getTracks().forEach(track => track.stop());
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

    const handleSave = () => {
        if (audioBlob) {
            onSave(audioBlob);
            setAudioBlob(null);
        }
    };

    const handleCancel = () => {
        setAudioBlob(null);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div style={styles.container}>
            {!audioBlob && !isRecording && (
                <button onClick={startRecording} style={styles.recordButton}>
                    <div style={styles.micIcon}>
                        <Mic size={24} />
                    </div>
                    <span>Record Daily Note</span>
                </button>
            )}
            
            {isRecording && (
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
                        <div style={styles.recordingTime}>{formatTime(recordingTime)}</div>
                        <div style={styles.recordingText}>Recording...</div>
                    </div>
                    <button onClick={stopRecording} style={styles.stopButton}>
                        <StopCircle size={20} />
                        <span>Stop</span>
                    </button>
                </div>
            )}
            
            {audioBlob && (
                <div style={styles.playbackContainer}>
                    <div style={styles.audioSection}>
                        <div style={styles.audioLabel}>Your Recording</div>
                        <audio src={URL.createObjectURL(audioBlob)} controls style={styles.audioPlayer}/>
                    </div>
                    <div style={styles.actionButtons}>
                        <button onClick={handleCancel} style={styles.cancelButton}>
                            <X size={20} />
                            <span>Discard</span>
                        </button>
                        <button onClick={handleSave} style={styles.saveButton}>
                            <Save size={20} />
                            <span>Save Note</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const styles = {
    container: { 
        backgroundColor: 'var(--card-background)', 
        padding: '2rem', 
        borderRadius: '16px', 
        boxShadow: 'var(--shadow)', 
        marginBottom: '2rem',
        transition: 'all 0.3s ease'
    },
    
    recordButton: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        width: '100%',
        padding: '1rem 2rem',
        backgroundColor: 'var(--primary-color)',
        color: 'white',
        border: 'none',
        borderRadius: '12px',
        cursor: 'pointer',
        fontSize: '1.1rem',
        fontWeight: '600',
        transition: 'all 0.2s ease',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
    } as React.CSSProperties,
    
    micIcon: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '40px',
        height: '40px',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: '50%'
    },
    
    recordingContainer: {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        gap: '1.5rem',
        padding: '1rem 0'
    },
    
    recordingVisual: {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        gap: '1rem'
    },
    
    pulsingCircle: {
        position: 'relative' as const,
        width: '120px',
        height: '120px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #ff6b6b, #ee5a24)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'pulse 2s infinite',
        boxShadow: '0 0 30px rgba(255, 107, 107, 0.4)'
    } as React.CSSProperties,
    
    innerCircle: {
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(10px)'
    },
    
    waveform: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        height: '40px'
    },
    
    waveBar: {
        width: '4px',
        backgroundColor: '#ff6b6b',
        borderRadius: '2px',
        animation: 'wave 1s infinite ease-in-out'
    } as React.CSSProperties,
    
    recordingInfo: {
        textAlign: 'center' as const,
        gap: '0.5rem'
    },
    
    recordingTime: {
        fontSize: '1.5rem',
        fontWeight: '700',
        color: '#ff6b6b',
        fontFamily: 'monospace'
    },
    
    recordingText: {
        fontSize: '1rem',
        color: '#666',
        opacity: 0.8
    },
    
    stopButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.75rem 1.5rem',
        backgroundColor: '#dc3545',
        color: 'white',
        border: 'none',
        borderRadius: '25px',
        cursor: 'pointer',
        fontSize: '1rem',
        fontWeight: '600',
        transition: 'all 0.2s ease',
        boxShadow: '0 4px 12px rgba(220, 53, 69, 0.3)'
    } as React.CSSProperties,
    
    playbackContainer: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '1.5rem'
    },
    
    audioSection: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '0.75rem'
    },
    
    audioLabel: {
        fontSize: '1rem',
        fontWeight: '600',
        color: '#333',
        marginBottom: '0.5rem'
    },
    
    audioPlayer: {
        width: '100%',
        borderRadius: '8px',
        outline: 'none'
    } as React.CSSProperties,
    
    actionButtons: {
        display: 'flex',
        gap: '1rem',
        justifyContent: 'space-between'
    },
    
    cancelButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.75rem 1.5rem',
        backgroundColor: '#6c757d',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '1rem',
        fontWeight: '500',
        flex: '1',
        justifyContent: 'center',
        transition: 'all 0.2s ease'
    } as React.CSSProperties,
    
    saveButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.75rem 1.5rem',
        backgroundColor: '#28a745',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '1rem',
        fontWeight: '500',
        flex: '1',
        justifyContent: 'center',
        transition: 'all 0.2s ease',
        boxShadow: '0 4px 12px rgba(40, 167, 69, 0.3)'
    } as React.CSSProperties,
};

export default AudioRecorder;
