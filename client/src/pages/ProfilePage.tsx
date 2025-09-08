
import React, { useState, useEffect, useRef } from 'react';
import { Camera, User as UserIcon, Heart, Target, LogOut, Plus, X } from 'lucide-react';
import Header from '../components/Header';
import { useAuthenticatedApi, getFileUrl } from '../utils/api';
import SupabaseImage from '../components/SupabaseImage';
import { useAuth } from '../contexts/AuthContext';

interface Profile {
    name: string;
    values: string[];
    mission: string;
    thinking_about?: string;
    profileImageUrl?: string;
}

const ProfilePage: React.FC = () => {
    const [profile, setProfile] = useState<Profile>({ name: '', values: [], mission: '', thinking_about: '', profileImageUrl: '' });
    const [status, setStatus] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isShowingCamera, setIsShowingCamera] = useState(false);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [tagInput, setTagInput] = useState('');
    const [focusedField, setFocusedField] = useState<string | null>(null);
    
    const api = useAuthenticatedApi();
    const { signOut } = useAuth();

    useEffect(() => {
        console.log('ProfilePage: Fetching profile...');
        api.get('/profile')
            .then(res => {
                console.log('ProfilePage: API response:', res);
                console.log('ProfilePage: Profile data:', res.data);
                if(res.data && res.data.profile) {
                    const profileData = res.data.profile;
                    const mappedProfile = {
                        name: profileData.name || '',
                        values: Array.isArray(profileData.values) 
                            ? profileData.values 
                            : profileData.values 
                                ? profileData.values.split(',').map((v: string) => v.trim()).filter((v: string) => v)
                                : [],
                        mission: profileData.mission || '',
                        thinking_about: profileData.thinking_about || '',
                        profileImageUrl: profileData.profile_image_url || ''
                    };
                    console.log('ProfilePage: Setting profile state:', mappedProfile);
                    setProfile(mappedProfile);
                }
            })
            .catch(err => {
                console.error("Error fetching profile:", err);
                console.error("Error details:", err.response?.data);
            });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Track profile state changes
    useEffect(() => {
        console.log('ProfilePage: Profile state changed:', profile);
    }, [profile]);

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
            const response = await api.post('/profile/image', formData, {
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
                const response = await api.post('/profile/image', formData, {
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
        const newValues = (profile.values || []).filter(tag => tag !== tagToRemove);
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
            await api.post('/profile', profileToSave);
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
        const existingValues = profile.values || [];
        const newValues = values.filter(value => !existingValues.includes(value));
        
        if (newValues.length === 0) {
            setTagInput('');
            return;
        }
        
        const updatedValues = [...(profile.values || []), ...newValues];
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
            await api.post('/profile', profileToSave);
        } catch (error) {
            console.error('Error saving tags:', error);
            setStatus('Error saving tags.');
        }
        
        setTagInput('');
    };


    const handleLogout = async () => {
        try {
            await signOut();
            setStatus('Logged out successfully!');
        } catch (error) {
            console.error('Error logging out:', error);
            setStatus('Error logging out.');
        }
    };

    const getInputStyle = (fieldName: string) => ({
        ...styles.input,
        borderColor: focusedField === fieldName ? '#7c3aed' : '#e5e7eb',
        backgroundColor: focusedField === fieldName ? '#ffffff' : '#f9fafb',
    });

    const getTextareaStyle = (fieldName: string) => ({
        ...styles.textarea,
        borderColor: focusedField === fieldName ? '#7c3aed' : '#e5e7eb',
        backgroundColor: focusedField === fieldName ? '#ffffff' : '#f9fafb',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Convert values array to string for backend compatibility
        const profileToSave = {
            ...profile,
            values: (profile.values || []).join(', ')
        };
        
        api.post('/profile', profileToSave)
            .then(() => setStatus('Profile saved successfully!'))
            .catch(() => setStatus('Error saving profile.'));
    };

    return (
        <div style={styles.container}>
            <Header title="Profile" />
            
            <div style={styles.contentContainer}>
                {/* Profile Card */}
                <div style={styles.profileCard}>
                    <div style={styles.profileImageContainer} onClick={handleProfilePictureClick}>
                        {profile.profileImageUrl ? (
                            <SupabaseImage
                                src={profile.profileImageUrl}
                                alt="Profile"
                                style={styles.profileImage}
                                fallback={
                                    <div style={styles.profileImagePlaceholder}>
                                        <span style={styles.profileImageInitial}>
                                            {profile.name ? profile.name.charAt(0).toUpperCase() : 'X'}
                                        </span>
                                    </div>
                                }
                            />
                        ) : (
                            <div style={styles.profileImagePlaceholder}>
                                <span style={styles.profileImageInitial}>
                                    {profile.name ? profile.name.charAt(0).toUpperCase() : 'X'}
                                </span>
                            </div>
                        )}
                        <div style={styles.cameraIconOverlay}>
                            <Camera size={20} color="white" />
                        </div>
                    </div>
                    
                    <h2 style={styles.profileName}>{profile.name || 'XJ'}</h2>
                    <p style={styles.profileDescription}>
                        This information helps create personalized meditations just for you.
                    </p>
                </div>

                {/* Hidden file input and camera modal */}
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

                {/* Form sections */}
                <form onSubmit={handleSubmit} style={styles.form}>
                    {/* Name Section */}
                    <div style={styles.section}>
                        <div style={styles.sectionHeader}>
                            <div style={styles.iconContainer}>
                                <UserIcon size={20} color="#6b7280" />
                            </div>
                            <h3 style={styles.sectionTitle}>Name</h3>
                        </div>
                        <div style={styles.sectionContent}>
                            <input 
                                type="text" 
                                name="name" 
                                value={profile.name} 
                                onChange={handleChange} 
                                onFocus={() => setFocusedField('name')}
                                onBlur={() => setFocusedField(null)}
                                style={getInputStyle('name')} 
                                placeholder="Enter your name"
                            />
                        </div>
                    </div>

                    {/* Core Values Section */}
                    <div style={styles.section}>
                        <div style={styles.sectionHeader}>
                            <div style={{...styles.iconContainer, backgroundColor: '#fef2f2'}}>
                                <Heart size={20} color="#ef4444" />
                            </div>
                            <h3 style={styles.sectionTitle}>Core Values</h3>
                        </div>
                        <div style={styles.sectionContent}>
                            <div style={styles.valuesContainer}>
                                {(profile.values || []).map((value, index) => (
                                    <div key={index} style={styles.valueTag}>
                                        <span>{value}</span>
                                        <X 
                                            size={16} 
                                            color="#666"
                                            style={styles.removeIcon}
                                            onClick={() => removeTag(value)}
                                        />
                                    </div>
                                ))}
                            </div>
                            <div style={styles.addValueContainer}>
                                <input 
                                    type="text" 
                                    value={tagInput} 
                                    onChange={handleTagInputChange}
                                    onKeyDown={handleTagInputKeyDown}
                                    onFocus={() => setFocusedField('values')}
                                    onBlur={() => setFocusedField(null)}
                                    style={{
                                        ...styles.valueInput,
                                        borderColor: focusedField === 'values' ? '#7c3aed' : '#e5e7eb',
                                        backgroundColor: focusedField === 'values' ? '#ffffff' : '#f9fafb',
                                    }} 
                                    placeholder="Type a value and press Enter to add"
                                />
                                <Plus 
                                    size={20} 
                                    color="#7c3aed"
                                    style={styles.addIcon}
                                    onClick={() => addMultipleTags(tagInput)}
                                />
                            </div>
                            <p style={styles.hint}>
                                You can add multiple values at once by typing A, B, C and then pressing Enter. Click on tags to remove them.
                            </p>
                        </div>
                    </div>

                    {/* Life Mission Section */}
                    <div style={styles.section}>
                        <div style={styles.sectionHeader}>
                            <div style={{...styles.iconContainer, backgroundColor: '#dcfce7'}}>
                                <Target size={20} color="#16a34a" />
                            </div>
                            <h3 style={styles.sectionTitle}>Life Mission</h3>
                        </div>
                        <div style={styles.sectionContent}>
                            <textarea 
                                name="mission" 
                                value={profile.mission} 
                                onChange={handleChange} 
                                onFocus={() => setFocusedField('mission')}
                                onBlur={() => setFocusedField(null)}
                                style={getTextareaStyle('mission')}
                                placeholder="What drives you? What do you want to achieve in life?"
                                rows={3}
                            />
                        </div>
                    </div>

                    {/* Thinking About Section */}
                    <div style={styles.section}>
                        <div style={styles.sectionHeader}>
                            <div style={{...styles.iconContainer, backgroundColor: '#fef3c7'}}>
                                <div style={styles.lightbulbIcon}>💡</div>
                            </div>
                            <h3 style={styles.sectionTitle}>Thinking about/Working on</h3>
                        </div>
                        <div style={styles.sectionContent}>
                            <textarea 
                                name="thinking_about" 
                                value={profile.thinking_about || ''} 
                                onChange={handleChange} 
                                onFocus={() => setFocusedField('thinking_about')}
                                onBlur={() => setFocusedField(null)}
                                style={getTextareaStyle('thinking_about')}
                                placeholder="What are you currently thinking about or working on?"
                                rows={3}
                            />
                        </div>
                    </div>

                    {/* Save Profile Button */}
                    <button type="submit" style={styles.saveButton}>
                        ✏️ Save Profile
                    </button>

                    {/* Log Out Button */}
                    <button type="button" onClick={handleLogout} style={styles.logoutButton}>
                        <LogOut size={20} color="#ef4444" />
                        Log Out
                    </button>
                </form>

                {status && <p style={styles.status}>{status}</p>}
            </div>
        </div>
    );
};

const styles = {
    container: { 
        paddingBottom: '100px',
        backgroundColor: '#f8f9ff',
        minHeight: '100vh',
        width: '100%',
    },
    contentContainer: {
        padding: '1rem',
        maxWidth: '500px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '1rem',
        backgroundColor: '#f3f4f6',
        marginTop: '-1rem',
        borderTopLeftRadius: '20px',
        borderTopRightRadius: '20px',
        minHeight: 'calc(100vh - 120px)',
    },
    profileCard: {
        background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
        borderRadius: '24px',
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        color: 'white',
        textAlign: 'center' as const,
    },
    profileImageContainer: {
        position: 'relative' as const,
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        cursor: 'pointer',
        marginBottom: '1rem',
        border: '3px solid white',
    },
    profileImage: {
        width: '100%',
        height: '100%',
        objectFit: 'cover' as const,
        borderRadius: '50%',
    },
    profileImagePlaceholder: {
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    profileImageInitial: {
        fontSize: '1.8rem',
        fontWeight: '700',
        color: 'white',
    },
    cameraIconOverlay: {
        position: 'absolute' as const,
        bottom: '0px',
        right: '0px',
        width: '28px',
        height: '28px',
        borderRadius: '50%',
        backgroundColor: '#6b7280',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '2px solid white',
    },
    profileName: {
        fontSize: '1.25rem',
        fontWeight: '700',
        margin: '0 0 0.5rem 0',
        color: 'white',
    },
    profileDescription: {
        fontSize: '0.9rem',
        color: 'rgba(255, 255, 255, 0.9)',
        margin: 0,
        lineHeight: 1.4,
    },
    form: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '1rem',
    },
    section: {
        backgroundColor: 'white',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    },
    sectionHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '1rem 1.25rem 0.5rem',
    },
    sectionTitle: {
        fontSize: '1rem',
        fontWeight: '600',
        color: '#1f2937',
        margin: 0,
    },
    iconContainer: {
        width: '40px',
        height: '40px',
        borderRadius: '12px',
        backgroundColor: '#f3f4f6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    lightbulbIcon: {
        fontSize: '1.25rem',
        width: '20px',
        height: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionContent: {
        padding: '0 1.25rem 1.25rem',
    },
    input: {
        width: '100%',
        padding: '0.75rem 1rem',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        fontSize: '1rem',
        color: '#1f2937',
        backgroundColor: '#f9fafb',
        outline: 'none',
        fontFamily: 'inherit',
        transition: 'border-color 0.2s, background-color 0.2s',
    },
    textarea: {
        width: '100%',
        padding: '0.75rem 1rem',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        fontSize: '1rem',
        color: '#1f2937',
        backgroundColor: '#f9fafb',
        outline: 'none',
        fontFamily: 'inherit',
        resize: 'none' as const,
        minHeight: '80px',
        transition: 'border-color 0.2s, background-color 0.2s',
    },
    valuesContainer: {
        display: 'flex',
        flexWrap: 'wrap' as const,
        gap: '0.5rem',
        marginBottom: '1rem',
    },
    valueTag: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem 0.75rem',
        backgroundColor: '#ede9fe',
        color: '#7c3aed',
        borderRadius: '20px',
        fontSize: '0.875rem',
        fontWeight: '500',
    },
    removeIcon: {
        cursor: 'pointer',
        padding: '2px',
        borderRadius: '50%',
        transition: 'background-color 0.2s',
    },
    addValueContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        marginBottom: '0.5rem',
    },
    valueInput: {
        flex: 1,
        padding: '0.75rem 1rem',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        fontSize: '1rem',
        color: '#1f2937',
        backgroundColor: '#f9fafb',
        outline: 'none',
        fontFamily: 'inherit',
        transition: 'border-color 0.2s, background-color 0.2s',
    },
    addIcon: {
        cursor: 'pointer',
        padding: '0.25rem',
        borderRadius: '50%',
        transition: 'background-color 0.2s',
    },
    hint: {
        fontSize: '0.75rem',
        color: '#6b7280',
        lineHeight: 1.4,
    },
    saveButton: {
        width: '100%',
        padding: '1rem',
        backgroundColor: '#7c3aed',
        color: 'white',
        border: 'none',
        borderRadius: '16px',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        transition: 'background-color 0.2s',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    },
    logoutButton: {
        width: '100%',
        padding: '1rem',
        backgroundColor: 'white',
        color: '#ef4444',
        border: '1px solid #fecaca',
        borderRadius: '16px',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        transition: 'background-color 0.2s',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
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
        border: '2px solid #7c3aed',
    },
    cameraControls: {
        display: 'flex',
        gap: '1rem',
    },
    captureButton: {
        padding: '1rem 2rem',
        backgroundColor: '#7c3aed',
        color: 'white',
        border: 'none',
        borderRadius: '12px',
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
        borderRadius: '12px',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
    status: { 
        marginTop: '1rem', 
        color: '#7c3aed',
        textAlign: 'center' as const,
        fontSize: '0.9rem',
        fontWeight: '500',
        backgroundColor: 'white',
        padding: '1rem',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    },
};

export default ProfilePage;
