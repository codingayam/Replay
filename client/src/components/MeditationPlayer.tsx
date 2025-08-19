
import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause } from 'lucide-react';

interface PlaylistItem {
    type: 'speech' | 'pause';
    audioUrl?: string;
    duration?: number;
}

interface MeditationPlayerProps {
    playlist: PlaylistItem[];
    onFinish: (completed: boolean) => void;
}

const MeditationPlayer: React.FC<MeditationPlayerProps> = ({ playlist, onFinish }) => {
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
                if (!isPaused) {
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

    const formatTime = (time: number) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const progress = (currentIndex / playlist.length) * 100;
    const currentItem = playlist[currentIndex];
    const audioProgress = currentItem?.type === 'speech' && totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

    return (
        <div style={styles.container}>
            <h2>Your Personalized Meditation</h2>
            
            {/* Overall progress */}
            <div style={styles.progressWrapper}>
                <div style={{...styles.progressBar, width: `${progress}%`}}></div>
            </div>
            
            {/* Audio progress (for speech segments) */}
            {currentItem?.type === 'speech' && (
                <div style={styles.audioProgressWrapper}>
                    <div 
                        style={styles.audioProgressContainer}
                        onClick={handleProgressBarClick}
                    >
                        <div style={{...styles.audioProgressBar, width: `${audioProgress}%`}}></div>
                    </div>
                    <div style={styles.timeDisplay}>
                        {formatTime(currentTime)} / {formatTime(totalDuration || 0)}
                    </div>
                </div>
            )}
            
            <p style={styles.status}>{status}</p>
            
            {/* Controls */}
            <div style={styles.controls}>
                <button onClick={togglePlayPause} style={styles.playButton}>
                    {isPlaying && !isPaused ? <Pause size={24} /> : <Play size={24} />}
                </button>
                <button onClick={() => onFinish(false)} style={styles.button}>End Session</button>
            </div>
            
            <audio ref={audioRef} onEnded={handleAudioEnded} />
        </div>
    );
};

const styles = {
    container: { backgroundColor: 'var(--card-background)', padding: '2rem', borderRadius: '8px', boxShadow: 'var(--shadow)', textAlign: 'center' as const, marginTop: '2rem' },
    progressWrapper: { height: '8px', backgroundColor: '#e9ecef', borderRadius: '4px', overflow: 'hidden', margin: '1rem 0' },
    progressBar: { height: '100%', backgroundColor: 'var(--primary-color)', transition: 'width 0.5s' },
    audioProgressWrapper: { margin: '1rem 0' },
    audioProgressContainer: { height: '12px', backgroundColor: '#e9ecef', borderRadius: '6px', overflow: 'hidden', cursor: 'pointer', margin: '0.5rem 0' },
    audioProgressBar: { height: '100%', backgroundColor: '#007bff', transition: 'width 0.1s' },
    timeDisplay: { fontSize: '0.9rem', color: '#6c757d', marginTop: '0.5rem' },
    status: { fontStyle: 'italic', color: '#6c757d', margin: '1rem 0' },
    controls: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1rem' },
    playButton: { padding: '0.75rem', border: '2px solid var(--primary-color)', borderRadius: '50%', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)', transition: 'all 0.2s' },
    button: { padding: '0.5rem 1rem', border: '1px solid #6c757d', borderRadius: '4px', background: 'transparent', cursor: 'pointer' }
};

export default MeditationPlayer;
