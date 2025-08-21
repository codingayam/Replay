
import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import BottomTabNavigation from './BottomTabNavigation';

interface PlaylistItem {
    type: 'speech' | 'pause';
    audioUrl?: string;
    duration?: number;
}

interface MeditationPlayerProps {
    playlist: PlaylistItem[];
    onFinish: (completed: boolean) => void;
    title?: string;
    author?: string;
}

const MeditationPlayer: React.FC<MeditationPlayerProps> = ({ 
    playlist, 
    onFinish, 
    title = "Your Personalized Meditation", 
    author = "Replay" 
}) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [status, setStatus] = useState('Starting...');
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [totalDuration, setTotalDuration] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);
    const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pauseStartTimeRef = useRef<number>(0);

    useEffect(() => {
        const calculateTotalDuration = () => {
            let total = 0;
            playlist.forEach(item => {
                if (item.type === 'pause' && item.duration) {
                    total += item.duration;
                }
            });
            setTotalDuration(total);
        };
        calculateTotalDuration();
    }, [playlist]);

    useEffect(() => {
        if (currentIndex >= playlist.length) {
            setStatus('Meditation complete.');
            setIsPlaying(false);
            onFinish(true);
            return;
        }

        if (isPaused) return;

        const currentItem = playlist[currentIndex];

        if (currentItem.type === 'speech') {
            setStatus('Speaking...');
            const audio = audioRef.current;
            if (audio && currentItem.audioUrl) {
                audio.src = `${currentItem.audioUrl}`;
                if (!isPaused && audio.paused) {
                    audio.play().then(() => setIsPlaying(true)).catch(e => console.error("Audio play failed:", e));
                }
            }
        } else if (currentItem.type === 'pause') {
            setStatus(`Pausing for ${currentItem.duration} seconds...`);
            pauseStartTimeRef.current = Date.now();
            const timer = setTimeout(() => {
                setCurrentIndex(i => i + 1);
            }, (currentItem.duration || 0) * 1000);
            pauseTimerRef.current = timer;
            return () => {
                if (pauseTimerRef.current) {
                    clearTimeout(pauseTimerRef.current);
                }
            };
        }
    }, [currentIndex, playlist, onFinish, isPaused]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const updateTime = () => setCurrentTime(audio.currentTime);
        const updateDuration = () => setTotalDuration(audio.duration);
        
        audio.addEventListener('timeupdate', updateTime);
        audio.addEventListener('loadedmetadata', updateDuration);
        audio.addEventListener('pause', () => setIsPlaying(false));
        audio.addEventListener('play', () => setIsPlaying(true));

        return () => {
            audio.removeEventListener('timeupdate', updateTime);
            audio.removeEventListener('loadedmetadata', updateDuration);
            audio.removeEventListener('pause', () => setIsPlaying(false));
            audio.removeEventListener('play', () => setIsPlaying(true));
        };
    }, [currentIndex]);

    const handleAudioEnded = () => {
        setCurrentIndex(i => i + 1);
    };

    const togglePlayPause = () => {
        const audio = audioRef.current;
        const currentItem = playlist[currentIndex];

        if (currentItem?.type === 'speech') {
            if (audio) {
                if (isPlaying) {
                    audio.pause();
                    setIsPaused(true);
                } else {
                    audio.play();
                    setIsPaused(false);
                }
            }
        } else if (currentItem?.type === 'pause') {
            if (isPaused) {
                const remainingTime = (currentItem.duration || 0) * 1000 - (Date.now() - pauseStartTimeRef.current);
                if (remainingTime > 0) {
                    const timer = setTimeout(() => {
                        setCurrentIndex(i => i + 1);
                    }, remainingTime);
                    pauseTimerRef.current = timer;
                }
                setIsPaused(false);
                setIsPlaying(true);
            } else {
                if (pauseTimerRef.current) {
                    clearTimeout(pauseTimerRef.current);
                }
                setIsPaused(true);
                setIsPlaying(false);
            }
        }
    };

    const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const audio = audioRef.current;
        const currentItem = playlist[currentIndex];
        
        if (currentItem?.type === 'speech' && audio && audio.duration) {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickPosition = (e.clientX - rect.left) / rect.width;
            const newTime = clickPosition * audio.duration;
            audio.currentTime = newTime;
            setCurrentTime(newTime);
        }
    };

    const handlePrevious = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
            setCurrentTime(0);
        }
    };

    const handleNext = () => {
        if (currentIndex < playlist.length - 1) {
            setCurrentIndex(currentIndex + 1);
            setCurrentTime(0);
        }
    };

    const formatTime = (time: number) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const currentItem = playlist[currentIndex];
    const audioProgress = currentItem?.type === 'speech' && totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;
    const remainingTime = totalDuration > 0 ? totalDuration - currentTime : 0;

    return (
        <div style={styles.container}>
            {/* Main Content */}
            <div style={styles.mainContent}>
                <div style={styles.playerContainer}>
                    {/* Album Art Placeholder */}
                    <div style={styles.albumArt}>
                        <div style={styles.albumArtPlaceholder}>
                            <div style={styles.meditationIcon}>🧘‍♀️</div>
                        </div>
                    </div>
                    
                    {/* Content Container */}
                    <div style={styles.contentContainer}>
                        {/* Song Details */}
                        <div style={styles.songDetails}>
                            <div style={styles.songInfo}>
                                <div style={styles.songTitle}>{title}</div>
                                <div style={styles.songArtist}>{author}</div>
                            </div>
                        </div>
                        
                        {/* Progress Bar */}
                        <div style={styles.progressSection}>
                            <div style={styles.progressContainer}>
                                <div 
                                    style={styles.progressTrack}
                                    onClick={handleProgressBarClick}
                                >
                                    <div style={{...styles.progressFill, width: `${audioProgress}%`}} />
                                </div>
                            </div>
                            <div style={styles.timeLabels}>
                                <div style={styles.timeLabel}>{formatTime(currentTime)}</div>
                                <div style={styles.timeLabel}>-{formatTime(remainingTime)}</div>
                            </div>
                        </div>
                        
                        {/* Play Controls */}
                        <div style={styles.playControls}>
                            <button 
                                onClick={handlePrevious} 
                                style={{...styles.controlButton, ...styles.secondaryButton}}
                                disabled={currentIndex === 0}
                            >
                                <SkipBack size={20} />
                            </button>
                            <button onClick={togglePlayPause} style={{...styles.controlButton, ...styles.primaryButton}}>
                                {isPlaying && !isPaused ? <Pause size={24} /> : <Play size={24} />}
                            </button>
                            <button 
                                onClick={handleNext} 
                                style={{...styles.controlButton, ...styles.secondaryButton}}
                                disabled={currentIndex >= playlist.length - 1}
                            >
                                <SkipForward size={20} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Bottom Tab Navigation */}
            <BottomTabNavigation />
            
            {/* Gesture Indicator Bar */}
            <div style={styles.gestureIndicatorContainer}>
                <div style={styles.gestureIndicator}></div>
            </div>
            
            {/* Hidden status for debugging */}
            <div style={styles.hiddenStatus}>{status}</div>
            
            <audio ref={audioRef} onEnded={handleAudioEnded} />
        </div>
    );
};

const styles = {
    container: {
        backgroundColor: '#ffffff',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column' as const,
        position: 'relative' as const,
    },
    mainContent: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column' as const,
        minHeight: '618px',
        paddingBottom: '88px', // Account for bottom navigation
    },
    playerContainer: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '32px',
        padding: '24px 16px',
        flex: 1,
    },
    albumArt: {
        height: '361px',
        width: '100%',
        borderRadius: '12px',
        overflow: 'hidden',
        position: 'relative' as const,
        backgroundImage: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    albumArtPlaceholder: {
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative' as const,
    },
    meditationIcon: {
        fontSize: '4rem',
        opacity: 0.8,
        color: 'rgba(255, 255, 255, 0.9)',
        textShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
    },
    contentContainer: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '61px',
        alignItems: 'center',
        flex: 1,
    },
    songDetails: {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
    },
    songInfo: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '4px',
        flex: 1,
        textAlign: 'center' as const,
    },
    songTitle: {
        fontSize: '17px',
        fontWeight: 'bold',
        color: '#000000',
        fontFamily: "'DM Sans', sans-serif",
    },
    songArtist: {
        fontSize: '13px',
        color: 'rgba(0,0,0,0.5)',
        fontFamily: "'DM Sans', sans-serif",
    },
    progressSection: {
        width: '100%',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '8px',
    },
    progressContainer: {
        width: '100%',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '8px',
    },
    progressTrack: {
        width: '100%',
        height: '6px',
        backgroundColor: 'rgba(0,0,0,0.06)',
        borderRadius: '360px',
        overflow: 'hidden',
        cursor: 'pointer',
        position: 'relative' as const,
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#4e3cdb',
        borderRadius: '360px',
        transition: 'width 0.1s',
    },
    timeLabels: {
        display: 'flex',
        justifyContent: 'space-between',
        width: '100%',
    },
    timeLabel: {
        fontSize: '13px',
        fontWeight: 'bold',
        color: 'rgba(0,0,0,0.5)',
        fontFamily: "'DM Sans', sans-serif",
    },
    playControls: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '66.5px',
        width: '277px',
    },
    controlButton: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        backgroundColor: 'transparent',
        cursor: 'pointer',
        transition: 'all 0.2s',
        color: '#000000',
    },
    primaryButton: {
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        backgroundColor: '#4e3cdb',
        color: 'white',
        boxShadow: '0 4px 12px rgba(78, 60, 219, 0.3)',
    },
    secondaryButton: {
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        opacity: 0.8,
        color: '#4e3cdb',
    },
    gestureIndicatorContainer: {
        position: 'absolute' as const,
        bottom: '100px', // Above bottom navigation
        left: 0,
        right: 0,
        height: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999,
    },
    gestureIndicator: {
        width: '120px',
        height: '4px',
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        borderRadius: '360px',
    },
    hiddenStatus: {
        position: 'absolute' as const,
        left: '-9999px',
        opacity: 0,
    },
};

export default MeditationPlayer;
