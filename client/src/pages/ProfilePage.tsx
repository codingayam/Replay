
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Header from '../components/Header';

const API_URL = 'http://localhost:3001/api';

const ProfilePage: React.FC = () => {
    const [profile, setProfile] = useState({ name: '', values: '', mission: '' });
    const [status, setStatus] = useState('');

    useEffect(() => {
        axios.get(`${API_URL}/profile`)
            .then(res => {
                if(res.data) {
                    setProfile(res.data);
                }
            })
            .catch(err => console.error("Error fetching profile:", err));
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setProfile({ ...profile, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        axios.post(`${API_URL}/profile`, profile)
            .then(() => setStatus('Profile saved successfully!'))
            .catch(() => setStatus('Error saving profile.'));
    };

    return (
        <div style={styles.container}>
            <Header />
            <div style={styles.formWrapper}>
                <p style={styles.description}>
                    This information helps create personalized meditations just for you.
                </p>
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
                    <input 
                        type="text" 
                        id="values" 
                        name="values" 
                        value={profile.values} 
                        onChange={handleChange} 
                        style={styles.input} 
                        placeholder="e.g., Growth, Compassion, Authenticity"
                    />
                    <small style={styles.hint}>Separate multiple values with commas</small>
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
    }
};

export default ProfilePage;
