
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = '/api';

interface Book {
    title: string;
    author: string;
}

const ProfilePage: React.FC = () => {
    const [profile, setProfile] = useState({ name: '', values: '', mission: '', books: [] as Book[] });
    const [status, setStatus] = useState('');

    useEffect(() => {
        axios.get(`${API_URL}/profile`)
            .then(res => {
                if(res.data) {
                    setProfile({ ...res.data, books: res.data.books || [] });
                }
            })
            .catch(err => console.error("Error fetching profile:", err));
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setProfile({ ...profile, [e.target.name]: e.target.value });
    };

    const addBook = () => {
        setProfile({ ...profile, books: [...profile.books, { title: '', author: '' }] });
    };

    const removeBook = (index: number) => {
        const newBooks = profile.books.filter((_, i) => i !== index);
        setProfile({ ...profile, books: newBooks });
    };

    const handleBookChange = (index: number, field: 'title' | 'author', value: string) => {
        const newBooks = [...profile.books];
        newBooks[index] = { ...newBooks[index], [field]: value };
        setProfile({ ...profile, books: newBooks });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        axios.post(`${API_URL}/profile`, profile)
            .then(() => setStatus('Profile saved successfully!'))
            .catch(() => setStatus('Error saving profile.'));
    };

    return (
        <div style={styles.container}>
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
                <div style={styles.field}>
                    <div style={styles.labelWithButton}>
                        <label style={styles.label}>Currently Reading</label>
                        <button type="button" onClick={addBook} style={styles.addButton}>
                            + Add Book
                        </button>
                    </div>
                    {profile.books.map((book, index) => (
                        <div key={index} style={styles.bookRow}>
                            <div style={styles.bookInputs}>
                                <input
                                    type="text"
                                    placeholder="Book title"
                                    value={book.title}
                                    onChange={(e) => handleBookChange(index, 'title', e.target.value)}
                                    style={styles.input}
                                />
                                <input
                                    type="text"
                                    placeholder="Author name"
                                    value={book.author}
                                    onChange={(e) => handleBookChange(index, 'author', e.target.value)}
                                    style={styles.input}
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => removeBook(index)}
                                style={styles.removeButton}
                            >
                                ×
                            </button>
                        </div>
                    ))}
                    {profile.books.length === 0 && (
                        <p style={styles.emptyState}>No books added yet. Click "Add Book" to get started.</p>
                    )}
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
    },
    labelWithButton: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.5rem',
    },
    addButton: {
        padding: '0.5rem 1rem',
        backgroundColor: 'var(--primary-color)',
        color: 'white',
        border: 'none',
        borderRadius: 'var(--border-radius)',
        fontSize: '0.85rem',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'opacity 0.2s ease',
    },
    bookRow: {
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'flex-start',
        marginBottom: '0.75rem',
    },
    bookInputs: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '0.5rem',
    },
    removeButton: {
        width: '40px',
        height: '40px',
        backgroundColor: '#ff4757',
        color: 'white',
        border: 'none',
        borderRadius: 'var(--border-radius)',
        fontSize: '1.2rem',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        marginTop: '0px',
        transition: 'opacity 0.2s ease',
    },
    emptyState: {
        color: 'var(--text-secondary)',
        fontSize: '0.9rem',
        fontStyle: 'italic',
        textAlign: 'center' as const,
        padding: '1rem',
        backgroundColor: 'var(--card-background)',
        borderRadius: 'var(--border-radius)',
        border: '2px dashed var(--card-border)',
        margin: '0.5rem 0',
    }
};

export default ProfilePage;
