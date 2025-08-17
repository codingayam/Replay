
import React, { useState, useRef } from 'react';
import { Mic, StopCircle, Save, X } from 'lucide-react';

interface AudioRecorderProps {
    onSave: (blob: Blob) => void;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({ onSave }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const mediaRecorder = useRef<MediaRecorder | null>(null);
    const audioChunks = useRef<Blob[]>([]);

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

    return (
        <div style={styles.container}>
            {!audioBlob && (
                <button onClick={isRecording ? stopRecording : startRecording} style={{...styles.button, ...(isRecording ? styles.stopButton : styles.recordButton)}}>
                    {isRecording ? <StopCircle /> : <Mic />} 
                    {isRecording ? 'Stop Recording' : 'Record Daily Note'}
                </button>
            )}
            {audioBlob && (
                <div style={styles.controls}>
                    <audio src={URL.createObjectURL(audioBlob)} controls style={{flexGrow: 1}}/>
                    <button onClick={handleSave} style={{...styles.button, ...styles.saveButton}}><Save size={20} /></button>
                    <button onClick={handleCancel} style={{...styles.button, ...styles.cancelButton}}><X size={20} /></button>
                </div>
            )}
        </div>
    );
};

const styles = {
    container: { backgroundColor: 'var(--card-background)', padding: '1.5rem', borderRadius: '8px', boxShadow: 'var(--shadow)', marginBottom: '2rem' },
    button: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem', fontWeight: '500' },
    recordButton: { backgroundColor: 'var(--primary-color)', color: 'white', width: '100%', justifyContent: 'center' },
    stopButton: { backgroundColor: '#dc3545', color: 'white', width: '100%', justifyContent: 'center' },
    controls: { display: 'flex', alignItems: 'center', gap: '1rem' },
    saveButton: { backgroundColor: '#28a745', color: 'white' },
    cancelButton: { backgroundColor: '#6c757d', color: 'white' },
};

export default AudioRecorder;
