
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Camera } from 'lucide-react';

interface Profile {
    name: string;
    values: string[];
    mission: string;
    profileImageUrl?: string;
}

const API_URL = '/api';


const ProfilePage: React.FC = () => {
    const [profile, setProfile] = useState<Profile>({ name: '', values: [], mission: '', profileImageUrl: '' });
    const [status, setStatus] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isShowingCamera, setIsShowingCamera] = useState(false);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [tagInput, setTagInput] = useState('');

    useEffect(() => {
        axios.get(`${API_URL}/profile`)
            .then(res => {
                if(res.data) {
                    setProfile({
                        name: res.data.name || '',
                        values: Array.isArray(res.data.values) 
                            ? res.data.values 
                            : res.data.values 
                                ? res.data.values.split(',').map((v: string) => v.trim()).filter((v: string) => v)
                                : [],
                        mission: res.data.mission || '',
                        profileImageUrl: res.data.profileImageUrl || ''
                    });
                }
            })
            .catch(err => console.error("Error fetching profile:", err));
    }, []);

    useEffect(() => {
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [stream]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setProfile({ ...profile, [e.target.name]: e.target.value });
    };

    const handleProfilePictureClick = () => {
        const choice = window.confirm('Choose: OK for Upload Photo, Cancel for Take Photo');
        
        if (choice) {
            fileInputRef.current?.click();
        } else {
            startCamera();
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('profileImage', file);

        try {
            const response = await axios.post(`${API_URL}/profile/image`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            setProfile(prev => ({ ...prev, profileImageUrl: response.data.profileImageUrl }));
            setStatus('Profile picture updated successfully!');
        } catch (error) {
            console.error('Error uploading profile picture:', error);
            setStatus('Error uploading profile picture.');
        }
    };

    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    width: { ideal: 640 },
                    height: { ideal: 640 },
                    facingMode: 'user'
                } 
            });
            
            setStream(mediaStream);
            setIsShowingCamera(true);
            
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
        } catch (error) {
            console.error('Error accessing camera:', error);
            setStatus('Error accessing camera. Please try uploading a photo instead.');
        }
    };

    const capturePhoto = async () => {
        if (!videoRef.current || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const video = videoRef.current;
        const context = canvas.getContext('2d');

        if (!context) return;

        canvas.width = 640;
        canvas.height = 640;
        
        // Draw video frame to canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert to blob
        canvas.toBlob(async (blob) => {
            if (!blob) return;

            const formData = new FormData();
            formData.append('profileImage', blob, 'profile-photo.jpg');

            try {
                const response = await axios.post(`${API_URL}/profile/image`, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                });

                setProfile(prev => ({ ...prev, profileImageUrl: response.data.profileImageUrl }));
                setStatus('Profile picture updated successfully!');
                stopCamera();
            } catch (error) {
                console.error('Error uploading profile picture:', error);
                setStatus('Error uploading profile picture.');
            }
        }, 'image/jpeg', 0.9);
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        setIsShowingCamera(false);
    };


    const removeTag = async (tagToRemove: string) => {
        const newValues = profile.values.filter(tag => tag !== tagToRemove);
        const updatedProfile = {
            ...profile,
            values: newValues
        };
        
        setProfile(updatedProfile);
        
        // Save to server immediately
        try {
            const profileToSave = {
                ...updatedProfile,
                values: newValues.join(', ')
            };
            await axios.post(`${API_URL}/profile`, profileToSave);
        } catch (error) {
            console.error('Error removing tag:', error);
            setStatus('Error removing tag.');
        }
    };

    const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTagInput(e.target.value);
    };

    const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addMultipleTags(tagInput);
        }
    };

    const addMultipleTags = async (input: string) => {
        const values = input.split(',').map(v => v.trim()).filter(v => v);
        
        if (values.length === 0) return;
        
        // Filter out values that already exist
        const newValues = values.filter(value => !profile.values.includes(value));
        
        if (newValues.length === 0) {
            setTagInput('');
            return;
        }
        
        const updatedValues = [...profile.values, ...newValues];
        const updatedProfile = {
            ...profile,
            values: updatedValues
        };
        
        setProfile(updatedProfile);
        
        // Save to server immediately
        try {
            const profileToSave = {
                ...updatedProfile,
                values: updatedValues.join(', ')
            };
            await axios.post(`${API_URL}/profile`, profileToSave);
        } catch (error) {
            console.error('Error saving tags:', error);
            setStatus('Error saving tags.');
        }
        
        setTagInput('');
    };


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Convert values array to string for backend compatibility
        const profileToSave = {
            ...profile,
            values: profile.values.join(', ')
        };
        
        axios.post(`${API_URL}/profile`, profileToSave)
            .then(() => setStatus('Profile saved successfully!'))
            .catch(() => setStatus('Error saving profile.'));
    };

    return (
        <div style={styles.container}>
            <div style={styles.formWrapper}>
                <p style={styles.description}>
                    This information helps create personalized meditations just for you.
                </p>
                
                {/* Profile Picture Section */}
                <div style={styles.profilePictureSection}>
                    <div style={styles.profilePictureContainer} onClick={handleProfilePictureClick}>
                        {profile.profileImageUrl ? (
                            <img 
                                src={profile.profileImageUrl} 
                                alt="Profile" 
                                style={styles.profileImage} 
                            />
                        ) : (
                            <div style={styles.profilePlaceholder}>
                                <Camera size={48} color="#666" />
                                <span style={styles.profilePlaceholderText}>Add Photo</span>
                            </div>
                        )}
                    </div>
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                />

                {isShowingCamera && (
                    <div style={styles.cameraModal}>
                        <div style={styles.cameraContainer}>
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                style={styles.video}
                            />
                            <canvas ref={canvasRef} style={{ display: 'none' }} />
                            <div style={styles.cameraControls}>
                                <button
                                    type="button"
                                    onClick={capturePhoto}
                                    style={styles.captureButton}
                                >
                                    Capture
                                </button>
                                <button
                                    type="button"
                                    onClick={stopCamera}
                                    style={styles.cancelButton}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            <form onSubmit={handleSubmit} style={styles.form}>
                <div style={styles.field}>
                    <label htmlFor="name" style={styles.label}>Name</label>
                    <input 
                        type="text" 
                        id="name" 
                        name="name" 
                        value={profile.name} 
                        onChange={handleChange} 
                        style={styles.input} 
                        placeholder="Enter your name"
                    />
                </div>
                <div style={styles.field}>
                    <label htmlFor="values" style={styles.label}>Core Values</label>
                    <div style={styles.tagCloud}>
                        {profile.values.map((tag, index) => (
                            <div 
                                key={index} 
                                style={styles.tag}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#ff4757';
                                    e.currentTarget.style.color = 'white';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'var(--primary-color)';
                                    e.currentTarget.style.color = 'white';
                                }}
                                onClick={() => removeTag(tag)}
                                title="Click to remove"
                            >
                                {tag} ×
                            </div>
                        ))}
                    </div>
                    <input 
                        type="text" 
                        id="values" 
                        value={tagInput} 
                        onChange={handleTagInputChange}
                        onKeyDown={handleTagInputKeyDown}
                        style={styles.tagInput} 
                        placeholder="Type a value and press Enter to add"
                    />
                    <small style={styles.hint}>You can add multiple values at once by typing A, B, C and then pressing Enter. Click on tags to remove them.</small>
                </div>
                <div style={styles.field}>
                    <label htmlFor="mission" style={styles.label}>Life Mission</label>
                    <textarea 
                        id="mission" 
                        name="mission" 
                        value={profile.mission} 
                        onChange={handleChange} 
                        style={styles.textarea}
                        placeholder="What drives you? What do you want to achieve in life?"
                    ></textarea>
                </div>
                <button type="submit" className="btn-primary" style={styles.button}>
                    Save Profile
                </button>
            </form>
            {status && <p style={styles.status}>{status}</p>}
            </div>
        </div>
    );
};

const styles = {
    container: { 
        paddingBottom: '100px', // Space for bottom navigation
        paddingTop: '1rem', // Space after Instagram-style header
    },
    formWrapper: {
        maxWidth: '600px', 
        margin: '0 auto',
        padding: '0 1rem',
    },
    description: {
        color: 'var(--text-secondary)',
        fontSize: '1rem',
        margin: '0 0 2rem 0',
        lineHeight: 1.5,
        textAlign: 'center' as const,
    },
    profilePictureSection: {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        marginBottom: '2rem',
        gap: '0.5rem',
    },
    profilePictureContainer: {
        width: '120px',
        height: '120px',
        borderRadius: '50%',
        cursor: 'pointer',
        border: '3px solid var(--primary-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--card-background)',
        transition: 'all 0.2s ease',
        overflow: 'hidden',
    },
    profileImage: {
        width: '100%',
        height: '100%',
        objectFit: 'cover' as const,
        borderRadius: '50%',
    },
    profilePlaceholder: {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        gap: '0.5rem',
        color: 'var(--text-secondary)',
    },
    profilePlaceholderText: {
        fontSize: '0.8rem',
        fontWeight: '500',
    },
    profilePictureLabel: {
        fontSize: '0.9rem',
        fontWeight: '600',
        color: 'var(--text-color)',
        margin: 0,
    },
    cameraModal: {
        position: 'fixed' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
    },
    cameraContainer: {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        gap: '1rem',
        padding: '2rem',
    },
    video: {
        width: '640px',
        height: '640px',
        maxWidth: '90vw',
        maxHeight: '50vh',
        objectFit: 'cover' as const,
        borderRadius: '1rem',
        border: '2px solid var(--primary-color)',
    },
    cameraControls: {
        display: 'flex',
        gap: '1rem',
    },
    captureButton: {
        padding: '1rem 2rem',
        backgroundColor: 'var(--primary-color)',
        color: 'white',
        border: 'none',
        borderRadius: 'var(--border-radius)',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
    cancelButton: {
        padding: '1rem 2rem',
        backgroundColor: 'transparent',
        color: 'white',
        border: '2px solid white',
        borderRadius: 'var(--border-radius)',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
    form: { 
        display: 'flex', 
        flexDirection: 'column' as const, 
        gap: '1.5rem',
    },
    field: { 
        display: 'flex', 
        flexDirection: 'column' as const,
        gap: '0.5rem',
    },
    label: {
        fontSize: '0.9rem',
        fontWeight: '600',
        color: 'var(--text-color)',
        marginBottom: '0.25rem',
    },
    input: { 
        padding: '1rem', 
        border: '2px solid var(--card-border)', 
        borderRadius: 'var(--border-radius)',
        fontSize: '1rem',
        backgroundColor: 'var(--card-background)',
        transition: 'all 0.2s ease',
        color: 'var(--text-color)',
    },
    textarea: { 
        padding: '1rem', 
        border: '2px solid var(--card-border)', 
        borderRadius: 'var(--border-radius)', 
        minHeight: '140px',
        fontSize: '1rem',
        backgroundColor: 'var(--card-background)',
        resize: 'vertical' as const,
        transition: 'all 0.2s ease',
        fontFamily: 'inherit',
        color: 'var(--text-color)',
        lineHeight: 1.6,
    },
    hint: {
        fontSize: '0.8rem',
        color: '#666',
        marginTop: '0.25rem',
    },
    tagCloud: {
        display: 'flex',
        flexWrap: 'wrap' as const,
        gap: '0.5rem',
        marginBottom: '0.75rem',
        minHeight: '2rem',
        padding: '0.5rem',
        backgroundColor: 'var(--card-background)',
        border: '2px solid var(--card-border)',
        borderRadius: 'var(--border-radius)',
    },
    tag: {
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.4rem 0.8rem',
        backgroundColor: 'var(--primary-color)',
        color: 'white',
        borderRadius: '20px',
        fontSize: '0.85rem',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        userSelect: 'none' as const,
        gap: '0.3rem',
    },
    tagInput: {
        padding: '1rem',
        border: '2px solid var(--card-border)',
        borderRadius: 'var(--border-radius)',
        fontSize: '1rem',
        backgroundColor: 'var(--card-background)',
        transition: 'all 0.2s ease',
        color: 'var(--text-color)',
        width: '100%',
    },
    button: { 
        padding: '1rem', 
        fontSize: '1rem',
        fontWeight: '600',
        marginTop: '0.5rem',
        cursor: 'pointer',
        width: '100%',
    },
    status: { 
        marginTop: '1rem', 
        color: 'var(--primary-color)',
        textAlign: 'center' as const,
        fontSize: '0.9rem',
        fontWeight: '500',
    },
};

export default ProfilePage;
