import React, { useState, useEffect, useRef } from 'react';
import { PlayCircle, Trash2, Share2, Image as ImageIcon, User, X, Play, Pause } from 'lucide-react';
import FloatingUploadButton from '../components/FloatingUploadButton';
import SupabaseImage from '../components/SupabaseImage';
import SearchBar from '../components/SearchBar';
import SearchResults from '../components/SearchResults';
import SearchResultModal from '../components/SearchResultModal';
import type { Note, SearchResult } from '../types';
import { getCategoryInfo } from '../utils/categoryUtils';
import { useAuthenticatedApi, getFileUrl } from '../utils/api';
import { groupNotesByDate, sortDateGroups } from '../utils/dateUtils';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const ExperiencesPage: React.FC = () => {
    const [notes, setNotes] = useState<Note[]>([]);
    const [currentAudio, setCurrentAudio] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
    
    // Search state
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState<boolean>(false);
    const [searchActive, setSearchActive] = useState<boolean>(false);
    
    // Modal state
    const [modalOpen, setModalOpen] = useState<boolean>(false);
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    
    const api = useAuthenticatedApi();
    const { user } = useAuth();

    const fetchNotes = async () => {
        try {
            const res = await api.get('/notes');
            // Sort notes by date, most recent first
            const sortedNotes = res.data.notes.sort((a: Note, b: Note) => 
                new Date(b.date).getTime() - new Date(a.date).getTime()
            );
            setNotes(sortedNotes);
        } catch (err) {
            console.error("Error fetching notes:", err);
        }
    };

    useEffect(() => {
        fetchNotes();
    }, []);

    const handleSaveAudioNote = async (blob: Blob) => {
        const formData = new FormData();
        formData.append('audio', blob, 'recording.wav');
        formData.append('localTimestamp', new Date().toISOString());
        try {
            await api.post('/notes', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            fetchNotes();
        } catch (err) {
            console.error("Error saving audio note:", err);
            alert('Failed to save audio note. See console for details.');
        }
    };

    const handleSavePhotoNote = async (file: File, caption: string) => {
        const formData = new FormData();
        formData.append('image', file);
        formData.append('caption', caption);
        formData.append('localTimestamp', new Date().toISOString());
        
        setIsUploadingPhoto(true);
        try {
            await api.post('/notes/photo', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            fetchNotes();
        } catch (err) {
            console.error("Error saving photo note:", err);
            alert('Failed to save photo note. See console for details.');
        } finally {
            setIsUploadingPhoto(false);
        }
    };

    const handleDeleteNote = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this note?')) {
            try {
                await api.delete(`/notes/${id}`);
                fetchNotes();
            } catch (err) {
                console.error("Error deleting note:", err);
            }
        }
    };

    const handlePlayNote = async (audioUrl: string) => {
        console.log('🎵 handlePlayNote called with audioUrl:', audioUrl);
        if (audioUrl && user) {
            try {
                let signedUrl = '';
                
                // Check if this is a Supabase Storage path or server path
                if (audioUrl.startsWith('/audio/')) {
                    console.log('🔍 Processing server path:', audioUrl);
                    // Extract the file path from server URL format: /audio/userId/filename
                    const pathParts = audioUrl.split('/');
                    console.log('📂 Path parts:', pathParts);
                    if (pathParts.length >= 4) {
                        const userId = pathParts[2];
                        const filename = pathParts.slice(3).join('/');
                        const storagePath = `${userId}/${filename}`;
                        console.log('🗂️ Storage path:', storagePath);
                        
                        // Generate signed URL from Supabase Storage
                        const { data, error } = await supabase.storage
                            .from('audio')
                            .createSignedUrl(storagePath, 3600); // 1 hour expiry
                            
                        if (error) {
                            console.error('❌ Error creating signed URL:', error);
                            return;
                        }
                        
                        signedUrl = data.signedUrl;
                        console.log('✅ Generated signed URL:', signedUrl);
                    } else {
                        console.error('❌ Invalid path parts length:', pathParts.length);
                    }
                } else {
                    console.log('🌐 Using direct URL:', audioUrl);
                    // If it's already a full URL, use it directly
                    signedUrl = audioUrl;
                }
                
                console.log('🎯 Final signedUrl:', signedUrl);
                setCurrentAudio(signedUrl);
                
                // Wait for the audio element to be rendered, then set source and play
                if (signedUrl) {
                    // Use setTimeout to wait for React to render the audio element
                    setTimeout(() => {
                        if (audioRef.current) {
                            console.log('▶️ Setting audio src and playing');
                            audioRef.current.src = signedUrl;
                            audioRef.current.load();
                            audioRef.current.play()
                                .then(() => {
                                    console.log('✅ Audio play succeeded');
                                    setIsPlaying(true);
                                })
                                .catch(e => console.error("❌ Audio play failed:", e));
                        } else {
                            console.error('❌ AudioRef still not available after timeout');
                        }
                    }, 100); // Wait 100ms for React to render
                } else {
                    console.error('❌ No signedUrl available');
                }
            } catch (error) {
                console.error('❌ Error preparing audio for playback:', error);
            }
        } else {
            console.error('❌ Missing audioUrl or user:', { audioUrl, user: !!user });
        }
    };




    const handleToggleExpand = (noteId: string) => {
        setExpandedNoteId(expandedNoteId === noteId ? null : noteId);
    };

    // Search functions
    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        setSearchActive(true);
        setIsSearching(true);

        try {
            const res = await api.get(`/notes/search?q=${encodeURIComponent(query)}&limit=50`);
            setSearchResults(res.data.results);
        } catch (error) {
            console.error('Search error:', error);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const handleClearSearch = () => {
        setSearchQuery('');
        setSearchResults([]);
        setSearchActive(false);
        setIsSearching(false);
    };

    const handleSearchResultClick = (noteId: string) => {
        setSelectedNoteId(noteId);
        setModalOpen(true);
    };

    const handleCloseModal = () => {
        setModalOpen(false);
        setSelectedNoteId(null);
    };

    // Group notes by date categories
    const groupedNotes = groupNotesByDate(notes);
    const sortedDateGroups = sortDateGroups(Object.keys(groupedNotes));

    return (
        <div style={styles.container}>
            {/* Search Bar */}
            <SearchBar
                onSearch={handleSearch}
                onClear={handleClearSearch}
                isSearching={isSearching}
            />

            {/* Search Results or Timeline */}
            {searchActive ? (
                <SearchResults
                    results={searchResults}
                    isLoading={isSearching}
                    query={searchQuery}
                    totalCount={searchResults.length}
                    onResultClick={handleSearchResultClick}
                />
            ) : (
                <div style={styles.timeline}>
                {sortedDateGroups.map((dateGroup, groupIndex) => {
                    const groupNotes = groupedNotes[dateGroup].sort((a, b) => 
                        new Date(b.date).getTime() - new Date(a.date).getTime()
                    );
                    
                    return (
                        <div key={dateGroup} style={styles.dateGroup}>
                            {/* Date category header */}
                            <h2 style={styles.dateHeader}>{dateGroup}</h2>
                            
                            {groupNotes.map((note, noteIndex) => {
                                const isExpanded = expandedNoteId === note.id;
                                const isLastInGroup = noteIndex === groupNotes.length - 1;
                                const isLastGroup = groupIndex === sortedDateGroups.length - 1;
                                const isLastOverall = isLastInGroup && isLastGroup;
                                const category = note.category || 'experience';
                                const categoryInfo = getCategoryInfo(category) || {
                                    name: 'experience',
                                    color: '#3b82f6',
                                    backgroundColor: '#dbeafe',
                                };
                                
                                return (
                                    <div key={note.id} style={styles.timelineItem}>
                                        {/* Timeline line and icon */}
                                        <div style={styles.timelineTrack}>
                                            <div 
                                                style={{
                                                    ...styles.timelineIcon,
                                                    backgroundColor: categoryInfo.backgroundColor,
                                                    borderColor: categoryInfo.color,
                                                }}
                                            >
                                                {note.type === 'photo' ? (
                                                    <ImageIcon size={8} style={{ color: categoryInfo.color }} />
                                                ) : (
                                                    <User size={8} style={{ color: categoryInfo.color }} />
                                                )}
                                            </div>
                                            {!isLastOverall && <div style={styles.timelineLine} />}
                                        </div>

                                        {/* Note content */}
                                        <div style={styles.noteContent}>
                                            <div 
                                                style={styles.noteHeader}
                                                onClick={() => handleToggleExpand(note.id)}
                                            >
                                                <div>
                                                    <h3 style={styles.noteTitle}>{note.title}</h3>
                                                    <p style={styles.noteDate}>
                                                        {new Date(note.date).toLocaleDateString('en-US', {
                                                            year: 'numeric',
                                                            month: 'short',
                                                            day: 'numeric'
                                                        })}
                                                    </p>
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div style={styles.expandedContent}>
                                                    {note.type === 'audio' ? (
                                                        <div>
                                                            <div style={styles.transcript}>
                                                                <p style={styles.transcriptText}>{note.transcript}</p>
                                                            </div>
                                                            <div style={styles.audioControls}>
                                                                <button 
                                                                    onClick={() => handlePlayNote(note.audioUrl!)}
                                                                    style={styles.playButton}
                                                                >
                                                                    <PlayCircle size={16} />
                                                                    Play Audio
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <div style={styles.photoContainer}>
                                                                <div style={styles.photoPlaceholder}>
                                                                    {note.imageUrl && (
                                                                        <SupabaseImage
                                                                            src={note.imageUrl}
                                                                            alt={note.title}
                                                                            style={styles.photo}
                                                                        />
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div style={styles.transcript}>
                                                                <p style={styles.transcriptText}>
                                                                    {note.type === 'photo' ? (note.originalCaption || 'No caption provided') : note.transcript}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    )}
                                                    
                                                    <div style={styles.actionButtons}>
                                                        <button 
                                                            onClick={() => handleDeleteNote(note.id)}
                                                            style={styles.deleteButton}
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                        <button style={styles.shareButton}>
                                                            <Share2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
                
                {notes.length === 0 && (
                    <div style={styles.emptyState}>
                        <p style={styles.emptyText}>No experiences recorded yet.</p>
                        <p style={styles.emptySubtext}>Tap the Upload button to record your first daily note.</p>
                    </div>
                )}
            </div>
            )}

            <FloatingUploadButton 
                onSaveAudio={handleSaveAudioNote}
                onSavePhoto={handleSavePhotoNote}
                isUploadingPhoto={isUploadingPhoto}
            />

            {/* Search Result Modal */}
            <SearchResultModal
                isOpen={modalOpen}
                onClose={handleCloseModal}
                noteId={selectedNoteId}
                searchQuery={searchQuery}
                onPlay={handlePlayNote}
            />

            {/* Bottom Audio Player */}
            {currentAudio && (
                <div style={styles.bottomPlayerContainer}>
                    <div style={styles.playerHeader}>
                        <div style={styles.playerIndicator}>
                            {isPlaying ? (
                                <Play size={16} style={{ color: '#3b82f6' }} />
                            ) : (
                                <PlayCircle size={16} style={{ color: '#3b82f6' }} />
                            )}
                            <span style={styles.playingText}>Playing Note</span>
                        </div>
                        <button 
                            onClick={() => {
                                setCurrentAudio(null);
                                setIsPlaying(false);
                                if (audioRef.current) {
                                    audioRef.current.pause();
                                    audioRef.current.src = '';
                                }
                            }}
                            style={styles.closeButton}
                        >
                            <X size={16} />
                        </button>
                    </div>
                    <audio 
                        ref={audioRef} 
                        controls 
                        style={styles.bottomAudioPlayer}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onEnded={() => setIsPlaying(false)}
                    />
                </div>
            )}
        </div>
    );
};

const styles = {
    container: {
        paddingBottom: '180px', // Space for FAB, bottom nav, and audio player
        paddingTop: '0.75rem',
        paddingLeft: '1rem',
        paddingRight: '1rem',
    },
    bottomPlayerContainer: {
        position: 'fixed' as const,
        bottom: '80px', // Above bottom navigation
        left: '0',
        right: '0',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderTop: '1px solid #e5e7eb',
        padding: '12px 16px',
        zIndex: 1000,
        boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.1)',
    },
    playerHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px',
    },
    playerIndicator: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    closeButton: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '4px',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#6b7280',
        transition: 'color 0.2s, background-color 0.2s',
    },
    playingText: {
        fontSize: '0.85rem',
        fontWeight: '500',
        color: '#3b82f6',
        fontFamily: 'var(--font-family)',
    },
    bottomAudioPlayer: {
        width: '100%',
        height: '32px',
    },
    timeline: {
        position: 'relative' as const,
    },
    dateGroup: {
        marginBottom: '2rem',
    },
    dateHeader: {
        fontSize: '1.1rem',
        fontWeight: '600',
        color: 'var(--text-color)',
        fontFamily: 'var(--font-family-heading)',
        marginBottom: '1rem',
        marginTop: '0',
        paddingLeft: '10px', // Align with timeline icons (20px width / 2 = 10px center)
    },
    timelineItem: {
        display: 'flex',
        marginBottom: '0.75rem',
        position: 'relative' as const,
    },
    timelineTrack: {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        marginRight: '0.75rem',
        position: 'relative' as const,
        paddingTop: '0.125rem',
    },
    timelineIcon: {
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        border: '1.5px solid',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        flexShrink: 0,
        zIndex: 2,
    },
    timelineLine: {
        width: '1px',
        backgroundColor: '#e5e7eb',
        flex: 1,
        minHeight: '30px',
        marginTop: '0.25rem',
    },
    noteContent: {
        flex: 1,
        minWidth: 0,
    },
    noteHeader: {
        cursor: 'pointer',
        paddingBottom: '0.25rem',
    },
    noteTitle: {
        margin: 0,
        fontSize: '0.9rem',
        fontWeight: '600',
        color: 'var(--text-color)',
        fontFamily: 'var(--font-family-heading)',
        lineHeight: '1.3',
        marginBottom: '0.125rem',
    },
    noteDate: {
        margin: 0,
        fontSize: '0.75rem',
        color: 'var(--text-secondary)',
        fontFamily: 'var(--font-family)',
        fontWeight: '400',
    },
    expandedContent: {
        marginTop: '1rem',
        padding: '1rem',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
    },
    transcript: {
        marginBottom: '1rem',
    },
    transcriptText: {
        margin: 0,
        fontSize: '0.9rem',
        lineHeight: '1.6',
        color: '#374151',
    },
    audioControls: {
        marginBottom: '1rem',
    },
    playButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.75rem 1.5rem',
        backgroundColor: '#3b82f6',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '0.9rem',
        fontWeight: '500',
        transition: 'background-color 0.2s',
        fontFamily: 'var(--font-family)',
    },
    photoContainer: {
        marginBottom: '1rem',
    },
    photoPlaceholder: {
        width: '100%',
        height: '200px',
        backgroundColor: '#f3f4f6',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    photo: {
        width: '100%',
        height: '100%',
        objectFit: 'cover' as const,
    },
    actionButtons: {
        display: 'flex',
        gap: '0.75rem',
        justifyContent: 'flex-end',
    },
    deleteButton: {
        width: '40px',
        height: '40px',
        borderRadius: '8px',
        border: 'none',
        backgroundColor: '#fee2e2',
        color: '#dc2626',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s',
    },
    shareButton: {
        width: '40px',
        height: '40px',
        borderRadius: '8px',
        border: 'none',
        backgroundColor: '#e5e7eb',
        color: '#6b7280',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s',
    },
    emptyState: {
        textAlign: 'center' as const,
        marginTop: '3rem',
        color: '#666',
    },
    emptyText: {
        fontSize: '1.1rem',
        marginBottom: '0.5rem',
    },
    emptySubtext: {
        fontSize: '0.9rem',
        color: '#999',
    },
};

export default ExperiencesPage;