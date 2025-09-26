import React, { useState, useEffect, useRef } from 'react';
import { PlayCircle, Trash2, Edit, Image as ImageIcon, User, X, Play, Pause, Mic, FileText } from 'lucide-react';
import FloatingUploadButton from '../components/FloatingUploadButton';
import SupabaseImage from '../components/SupabaseImage';
import Header from '../components/Header';
import SearchResults from '../components/SearchResults';
import SearchResultModal from '../components/SearchResultModal';
import ReplayModeSelectionModal from '../components/ReplayModeSelectionModal';
import DurationSelectorModal from '../components/DurationSelectorModal';
import ReadyToBeginModal from '../components/ReadyToBeginModal';
import MeditationGeneratingModal from '../components/MeditationGeneratingModal';
import MeditationPlayer from '../components/MeditationPlayer';
import EditExperienceModal from '../components/EditExperienceModal';
import type { Note, SearchResult } from '../types';

interface PlaylistItem {
    type: 'speech' | 'pause';
    audioUrl?: string;
    duration?: number;
}
import { useAuthenticatedApi, getFileUrl } from '../utils/api';
import { groupNotesByDate, sortDateGroups } from '../utils/dateUtils';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useResponsive } from '../hooks/useResponsive';

const ExperiencesPage: React.FC = () => {
    const [notes, setNotes] = useState<Note[]>([]);
    const [currentAudio, setCurrentAudio] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [isUploadingText, setIsUploadingText] = useState(false);
    const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
    
    // Search state
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState<boolean>(false);
    const [searchActive, setSearchActive] = useState<boolean>(false);
    
    // Modal state
    const [modalOpen, setModalOpen] = useState<boolean>(false);
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    
    // Edit modal state
    const [editModalOpen, setEditModalOpen] = useState<boolean>(false);
    const [noteToEdit, setNoteToEdit] = useState<Note | null>(null);
    
    // Multi-select state
    const [selectionMode, setSelectionMode] = useState<boolean>(false);
    const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
    const [showReplayModal, setShowReplayModal] = useState<boolean>(false);
    
    // Meditative replay state
    const [showDurationModal, setShowDurationModal] = useState(false);
    const [showReadyToBeginModal, setShowReadyToBeginModal] = useState(false);
    const [showMeditationGeneratingModal, setShowMeditationGeneratingModal] = useState(false);
    const [meditationPlaylist, setMeditationPlaylist] = useState<PlaylistItem[] | null>(null);
    const [currentMeditationId, setCurrentMeditationId] = useState<string | null>(null);
    const [selectedDuration, setSelectedDuration] = useState(5);
    const [recommendedDuration, setRecommendedDuration] = useState(5);
    const [isGeneratingMeditation, setIsGeneratingMeditation] = useState(false);
    const [isMeditationApiComplete, setIsMeditationApiComplete] = useState(false);
    const [generatedSummary, setGeneratedSummary] = useState('');
    
    // Radio state
    const [radioPlaylist, setRadioPlaylist] = useState<PlaylistItem[] | null>(null);
    const [isGeneratingRadio, setIsGeneratingRadio] = useState(false);
    const [isRadioApiComplete, setIsRadioApiComplete] = useState(false);
    
    const api = useAuthenticatedApi();
    const { user } = useAuth();
    const { isDesktop } = useResponsive();
    
    // Calculate recommended duration based on number of experiences
    const calculateRecommendedDuration = (experienceCount: number): number => {
        if (experienceCount <= 3) return 5;
        if (experienceCount <= 6) return 10;
        if (experienceCount <= 9) return 15;
        return 20;
    };

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

    const handleSaveTextNote = async (title: string, content: string, image?: File) => {
        const formData = new FormData();
        formData.append('title', title);
        formData.append('content', content);
        formData.append('date', new Date().toISOString());
        
        if (image) {
            formData.append('image', image);
        }
        
        setIsUploadingText(true);
        try {
            await api.post('/notes/text', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            fetchNotes();
        } catch (err) {
            console.error("Error saving text note:", err);
            alert('Failed to save text note. See console for details.');
        } finally {
            setIsUploadingText(false);
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

    const handleEditNote = (note: Note) => {
        setNoteToEdit(note);
        setEditModalOpen(true);
    };

    const handleUpdateNote = async (noteId: string, updates: { title: string; transcript: string }) => {
        try {
            await api.put(`/notes/${noteId}`, updates);
            fetchNotes(); // Refresh the notes list
            setEditModalOpen(false);
            setNoteToEdit(null);
        } catch (err) {
            console.error("Error updating note:", err);
            alert('Failed to update note. Please try again.');
        }
    };

    const handleCloseEditModal = () => {
        setEditModalOpen(false);
        setNoteToEdit(null);
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
            setSearchResults(res.data.results || []);
        } catch (error) {
            console.error('Search error:', error);
            // Don't show error to user, just clear results
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

    // Multi-select handlers
    const handleLongPress = (noteId: string) => {
        if (!selectionMode) {
            setSelectionMode(true);
            setSelectedNoteIds(new Set([noteId]));
        }
    };

    const handleNoteSelect = (noteId: string) => {
        if (selectionMode) {
            const newSelection = new Set(selectedNoteIds);
            if (newSelection.has(noteId)) {
                newSelection.delete(noteId);
            } else {
                newSelection.add(noteId);
            }
            setSelectedNoteIds(newSelection);
            
            // Exit selection mode if no notes are selected
            if (newSelection.size === 0) {
                setSelectionMode(false);
            }
        }
    };

    const handleSelectAll = () => {
        setSelectedNoteIds(new Set(notes.map(note => note.id)));
    };

    const handleClearSelection = () => {
        setSelectedNoteIds(new Set());
        setSelectionMode(false);
    };

    const handleGenerateFromSelection = () => {
        if (selectedNoteIds.size > 0) {
            setShowReplayModal(true);
        }
    };

    const handleReplayModeSelection = (mode: 'Casual' | 'Meditative') => {
        setShowReplayModal(false);
        
        if (mode === 'Meditative') {
            // Calculate recommended duration for selected experiences
            const calculatedDuration = calculateRecommendedDuration(selectedNoteIds.size);
            setRecommendedDuration(calculatedDuration);
            setSelectedDuration(calculatedDuration);
            setShowDurationModal(true);
        } else {
            // Radio mode (Casual) - skip duration selection and generate directly
            handleRadioGeneration();
        }
    };

    // Radio generation handler
    const handleRadioGeneration = async () => {
        setIsGeneratingRadio(true);
        setIsRadioApiComplete(false);
        setShowMeditationGeneratingModal(true); // Reuse the same loading modal

        try {
            console.log('📻 Generating radio show from selected experiences...');
            const response = await api.post('/replay/radio', {
                noteIds: Array.from(selectedNoteIds),
                duration: 5, // Fixed 5 minutes for radio
                title: `Radio Show - ${new Date().toLocaleDateString()}`
            });

            setRadioPlaylist(response.data.radioShow.playlist);
            
            // Mark API as complete - loading modal will handle the transition
            console.log('✅ Radio API Success - setting isRadioApiComplete to true');
            setIsRadioApiComplete(true);
        } catch (err) {
            console.error('Error generating radio show:', err);
            alert('Failed to generate radio show. Please try again.');
            setIsGeneratingRadio(false);
            setIsRadioApiComplete(false);
            setShowMeditationGeneratingModal(false);
            handleClearSelection();
        }
    };

    const handleRadioReady = () => {
        console.log('🎯 handleRadioReady called');
        console.log('📊 radioPlaylist:', radioPlaylist);
        
        // Called when the loading animation completes
        setIsGeneratingRadio(false);
        setIsRadioApiComplete(false);
        setShowMeditationGeneratingModal(false);
        
        // Only proceed if we actually have a playlist
        if (radioPlaylist && radioPlaylist.length > 0) {
            console.log('✅ Valid radio playlist found, starting playback');
            // Playlist will be used by MeditationPlayer component
        } else {
            console.log('❌ No valid radio playlist found');
            alert('Radio generation failed. Please try again when the server is running.');
            // Reset state
            setRadioPlaylist(null);
            handleClearSelection();
        }
    };

    const handleRadioFinish = (completed: boolean) => {
        console.log(`🎯 Radio finished - completed: ${completed}`);
        setRadioPlaylist(null);
        
        // Clear selection and exit selection mode
        handleClearSelection();
    };

    // Meditative replay modal handlers
    const handleDurationSelection = (duration: number) => {
        setSelectedDuration(duration);
        setShowDurationModal(false);
        setShowReadyToBeginModal(true);
    };

    const handleReadyToBeginBack = () => {
        setShowReadyToBeginModal(false);
        setShowDurationModal(true);
    };

    const handleReadyToBeginStart = async () => {
        setShowReadyToBeginModal(false);
        setIsGeneratingMeditation(true);
        setIsMeditationApiComplete(false);
        setShowMeditationGeneratingModal(true);

        try {
            console.log('🧘 Generating meditation from selected experiences...');
            const response = await api.post('/meditate', {
                noteIds: Array.from(selectedNoteIds),
                duration: selectedDuration,
                reflectionType: 'Night',
                title: `Night Meditation - ${new Date().toLocaleDateString()}`
            });

            setMeditationPlaylist(response.data.playlist);
            setCurrentMeditationId(response.data.meditationId || response.data.id);
            setGeneratedSummary(response.data.summary || '');
            
            // Mark API as complete - loading modal will handle the transition
            console.log('✅ Meditation API Success - setting isMeditationApiComplete to true');
            setIsMeditationApiComplete(true);
        } catch (err) {
            console.error('Error generating meditation:', err);
            alert('Failed to generate meditation. Please try again.');
            setIsGeneratingMeditation(false);
            setIsMeditationApiComplete(false);
            setShowMeditationGeneratingModal(false);
        }
    };

    const handleMeditationReady = () => {
        console.log('🎯 handleMeditationReady called');
        console.log('📊 meditationPlaylist:', meditationPlaylist);
        
        // Called when the loading animation completes
        setIsGeneratingMeditation(false);
        setIsMeditationApiComplete(false);
        setShowMeditationGeneratingModal(false);
        
        // Only proceed if we actually have a playlist
        if (meditationPlaylist && meditationPlaylist.length > 0) {
            console.log('✅ Valid playlist found, starting meditation');
            // Playlist will be used by MeditationPlayer component
        } else {
            console.log('❌ No valid playlist found');
            alert('Meditation generation failed. Please try again when the server is running.');
            // Reset state
            setMeditationPlaylist(null);
            setGeneratedSummary('');
        }
    };

    const handleMeditationFinish = (completed: boolean) => {
        console.log(`🎯 Meditation finished - completed: ${completed}`);
        setMeditationPlaylist(null);
        setCurrentMeditationId(null);
        setGeneratedSummary('');
        
        // Clear selection and exit selection mode
        handleClearSelection();
    };

    // Group notes by date categories
    const groupedNotes = groupNotesByDate(notes);
    const sortedDateGroups = sortDateGroups(Object.keys(groupedNotes));

    // Show meditation player if we have a playlist (meditation or radio)
    if (meditationPlaylist) {
        return <MeditationPlayer playlist={meditationPlaylist} onFinish={handleMeditationFinish} meditationId={currentMeditationId || undefined} />;
    }
    
    // Show radio player if we have a radio playlist
    if (radioPlaylist) {
        return <MeditationPlayer playlist={radioPlaylist} onFinish={handleRadioFinish} />;
    }

    return (
        <div style={isDesktop ? styles.desktopContainer : styles.container}>
            {/* Header with integrated search - only show on mobile */}
            {!isDesktop && (
                <Header
                    showSearch={true}
                    searchPlaceholder="Search your experiences..."
                    onSearch={handleSearch}
                    onClearSearch={handleClearSearch}
                    searchQuery={searchQuery}
                    isSearching={isSearching}
                />
            )}

            {/* Desktop Header */}
            {isDesktop && (
                <div style={styles.desktopHeader}>
                    <div style={styles.desktopHeaderContent}>
                        <div style={styles.desktopTitleSection}>
                            <h1 style={styles.desktopTitle}>Experiences</h1>
                            <p style={styles.desktopSubtitle}>Moments captured on your daily journey</p>
                            <span style={styles.experienceCount}>{notes.length} experiences</span>
                        </div>
                        <div style={styles.desktopSearchSection}>
                            <div style={styles.searchContainer}>
                                <input
                                    type="text"
                                    placeholder="Search your experiences..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setSearchQuery(value);
                                        if (value.trim()) {
                                            handleSearch(value);
                                        } else {
                                            handleClearSearch();
                                        }
                                    }}
                                    style={styles.desktopSearchInput}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Search Results or Timeline */}
            {searchActive ? (
                <div style={isDesktop ? styles.desktopContentContainer : styles.contentContainer}>
                    <SearchResults
                        results={searchResults}
                        isLoading={isSearching}
                        query={searchQuery}
                        totalCount={searchResults.length}
                        onResultClick={handleSearchResultClick}
                    />
                </div>
            ) : (
                <div style={isDesktop ? styles.desktopContentContainer : styles.contentContainer}>
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
                                    const isSelected = selectedNoteIds.has(note.id);
                                    
                                    return (
                                        <div 
                                            key={note.id} 
                                            style={{
                                                ...styles.noteCard,
                                                ...(isSelected ? styles.selectedNoteCard : {}),
                                                ...(selectionMode ? styles.selectableNoteCard : {})
                                            }}
                                            onTouchStart={(e) => {
                                                if (!selectionMode) {
                                                    // Start long press timer
                                                    const timer = setTimeout(() => {
                                                        handleLongPress(note.id);
                                                    }, 500); // 500ms long press
                                                    
                                                    const cleanup = () => {
                                                        clearTimeout(timer);
                                                        e.target.removeEventListener('touchend', cleanup);
                                                        e.target.removeEventListener('touchmove', cleanup);
                                                    };
                                                    
                                                    e.target.addEventListener('touchend', cleanup);
                                                    e.target.addEventListener('touchmove', cleanup);
                                                }
                                            }}
                                            onClick={(e) => {
                                                if (selectionMode) {
                                                    e.stopPropagation();
                                                    handleNoteSelect(note.id);
                                                } else {
                                                    // Only expand on tap when not in selection mode
                                                    handleToggleExpand(note.id);
                                                }
                                            }}
                                        >
                                            {/* Selection checkbox (only visible in selection mode) */}
                                            {selectionMode && (
                                                <div style={styles.selectionCheckbox}>
                                                    <div style={isSelected ? styles.selectedCheckbox : styles.unselectedCheckbox}>
                                                        {isSelected && '✓'}
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {/* Note icon */}
                                            <div style={styles.noteIcon}>
                                                {note.type === 'photo' ? (
                                                    <ImageIcon size={16} style={{ color: '#6366f1' }} />
                                                ) : note.type === 'text' ? (
                                                    <FileText size={16} style={{ color: '#6366f1' }} />
                                                ) : (
                                                    <Mic size={16} style={{ color: '#6366f1' }} />
                                                )}
                                            </div>

                                            {/* Note content */}
                                            <div style={styles.noteContentNew}>
                                                <div 
                                                    style={styles.noteHeaderNew}
                                                >
                                                    <h3 style={styles.noteTitleNew}>{note.title}</h3>
                                                    <p style={styles.noteDateNew}>
                                                        {new Date(note.date).toLocaleDateString('en-US', {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            year: 'numeric'
                                                        })}
                                                    </p>
                                                </div>

                                                {isExpanded && (
                                                    <div style={styles.expandedContentNew}>
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
                                                        ) : note.type === 'text' ? (
                                                            <div>
                                                                {/* Optional image for text notes */}
                                                                {note.imageUrl && note.imageUrl.trim() && (
                                                                    <div style={styles.photoContainer}>
                                                                        <div style={styles.photoPlaceholder}>
                                                                            <SupabaseImage
                                                                                src={note.imageUrl}
                                                                                alt={note.userTitle || note.title}
                                                                                style={styles.photo}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                <div style={styles.transcript}>
                                                                    <p style={styles.transcriptText}>
                                                                        {note.transcript}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div>
                                                                {/* Photo notes */}
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
                                                                        {note.originalCaption || 'No caption provided'}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        )}
                                                        
                                                        <div style={styles.actionButtons}>
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleEditNote(note);
                                                                }}
                                                                style={styles.editButton}
                                                            >
                                                                <Edit size={16} />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDeleteNote(note.id)}
                                                                style={styles.deleteButton}
                                                            >
                                                                <Trash2 size={16} />
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
                </div>
            )}

            <FloatingUploadButton 
                onSaveAudio={handleSaveAudioNote}
                onSavePhoto={handleSavePhotoNote}
                onSaveText={handleSaveTextNote}
                isUploadingPhoto={isUploadingPhoto}
                isUploadingText={isUploadingText}
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

            {/* Selection Bar */}
            {selectionMode && !showReplayModal && !showDurationModal && !showReadyToBeginModal && !showMeditationGeneratingModal && (
                <div style={styles.selectionBar}>
                    <div style={styles.selectionBarContent}>
                        <span style={styles.selectionCount}>{selectedNoteIds.size} selected</span>
                        <div style={styles.selectionBarActions}>
                            <button onClick={handleSelectAll} style={styles.selectAllButton}>
                                <span style={styles.selectAllIcon}>☑</span>
                                <span>Select All</span>
                            </button>
                            <button onClick={handleClearSelection} style={styles.clearSelectionButton}>
                                ✕
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Replay Button */}
            {selectedNoteIds.size > 0 && (
                <div style={styles.replayButtonContainer}>
                    <button 
                        onClick={handleGenerateFromSelection}
                        style={styles.replayButton}
                    >
                        <span style={styles.replayButtonIcon}>⚙</span>
                        <span style={styles.replayButtonText}>Replay ({selectedNoteIds.size} experiences)</span>
                    </button>
                </div>
            )}

            {/* Replay Mode Selection Modal */}
            <ReplayModeSelectionModal
                isOpen={showReplayModal}
                onClose={() => setShowReplayModal(false)}
                onSelectMode={handleReplayModeSelection}
            />

            {/* Duration Selection Modal */}
            <DurationSelectorModal
                isOpen={showDurationModal}
                onClose={() => setShowDurationModal(false)}
                onSelectDuration={handleDurationSelection}
                recommendedDuration={recommendedDuration}
            />

            {/* Ready to Begin Modal */}
            <ReadyToBeginModal
                isOpen={showReadyToBeginModal}
                onClose={() => setShowReadyToBeginModal(false)}
                onBack={handleReadyToBeginBack}
                onStart={handleReadyToBeginStart}
                reflectionType="Night Meditation"
                period="Selected Experiences"
                experienceCount={selectedNoteIds.size}
                duration={selectedDuration}
            />

            {/* Meditation/Radio Generating Modal */}
            <MeditationGeneratingModal
                isOpen={showMeditationGeneratingModal}
                onClose={() => setShowMeditationGeneratingModal(false)}
                isGenerating={isGeneratingMeditation || isGeneratingRadio}
                isApiComplete={isMeditationApiComplete || isRadioApiComplete}
                onMeditationReady={isGeneratingRadio ? handleRadioReady : handleMeditationReady}
                onRunInBackground={() => {
                    setShowMeditationGeneratingModal(false);
                    setIsGeneratingMeditation(false);
                    setIsGeneratingRadio(false);
                    handleClearSelection();
                }}
            />

            {/* Edit Experience Modal */}
            {noteToEdit && (
                <EditExperienceModal
                    isOpen={editModalOpen}
                    onClose={handleCloseEditModal}
                    note={noteToEdit}
                    onSave={handleUpdateNote}
                />
            )}
        </div>
    );
};

const styles = {
    container: {
        paddingBottom: '160px', // Space for FAB, bottom nav, and audio player
        backgroundColor: '#f8f9ff',
        minHeight: '100vh',
        width: '100%',
        position: 'relative',
    },
    desktopContainer: {
        backgroundColor: 'transparent',
        minHeight: '100vh',
        width: '100%',
        position: 'relative',
    },
    desktopHeader: {
        marginBottom: '2rem',
        paddingBottom: '1.5rem',
        borderBottom: '1px solid #e5e7eb',
    },
    desktopHeaderContent: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '2rem',
    },
    desktopTitleSection: {
        flex: 1,
    },
    desktopTitle: {
        fontSize: '2rem',
        fontWeight: '700',
        color: '#1f2937',
        margin: '0 0 0.5rem 0',
        fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    desktopSubtitle: {
        fontSize: '1rem',
        color: '#6b7280',
        margin: '0 0 0.75rem 0',
        fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    experienceCount: {
        display: 'inline-block',
        padding: '0.25rem 0.75rem',
        backgroundColor: '#ede9fe',
        color: '#6366f1',
        borderRadius: '20px',
        fontSize: '0.875rem',
        fontWeight: '500',
    },
    desktopSearchSection: {
        flex: '0 0 400px',
    },
    desktopSearchInput: {
        width: '100%',
        padding: '12px 16px',
        borderRadius: '12px',
        border: '1px solid #d1d5db',
        backgroundColor: '#ffffff',
        fontSize: '16px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#374151',
        outline: 'none',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
        transition: 'border-color 0.2s, box-shadow 0.2s',
    },
    desktopContentContainer: {
        padding: '0',
        backgroundColor: 'transparent',
        borderRadius: '0',
        minHeight: 'auto',
        maxWidth: '100%',
        margin: '0',
        boxSizing: 'border-box',
    },
    contentContainer: {
        padding: '1.5rem 1rem',
        backgroundColor: '#ffffff',
        marginTop: '-1rem',
        borderTopLeftRadius: '20px',
        borderTopRightRadius: '20px',
        minHeight: 'calc(100vh - 120px)',
        maxWidth: '100%',
        margin: '-1rem auto 0 auto',
        boxSizing: 'border-box',
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
        fontSize: '1.25rem',
        fontWeight: '600',
        color: '#1f2937',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        marginBottom: '1rem',
        marginTop: '0',
        borderBottom: '2px solid #6366f1',
        paddingBottom: '0.5rem',
        display: 'inline-block',
    },
    noteCard: {
        position: 'relative', // Add this for absolute positioned checkbox
        display: 'flex',
        alignItems: 'flex-start',
        gap: '1rem',
        padding: '1rem',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        marginBottom: '1rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        border: '1px solid #f3f4f6',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        '&:hover': {
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        },
    },
    noteIcon: {
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        backgroundColor: '#ede9fe',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        marginTop: '4px',
    },
    noteContentNew: {
        flex: 1,
        minWidth: 0,
    },
    noteHeaderNew: {
        marginBottom: '0.5rem',
    },
    noteTitleNew: {
        margin: 0,
        fontSize: '1rem',
        fontWeight: '600',
        color: '#1f2937',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        lineHeight: '1.4',
        marginBottom: '0.25rem',
        paddingRight: '32px', // Add space for checkbox when in selection mode
        wordWrap: 'break-word',
        overflowWrap: 'break-word',
        hyphens: 'auto',
        display: '-webkit-box',
        WebkitLineClamp: 2, // Limit to 2 lines
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
    },
    noteDateNew: {
        margin: 0,
        fontSize: '0.875rem',
        color: '#6b7280',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontWeight: '400',
    },
    expandedContentNew: {
        marginTop: '1rem',
        padding: '1rem',
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
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
        backgroundColor: '#f3f4f6',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.5rem',
    },
    photo: {
        maxWidth: '100%',
        height: 'auto',
        maxHeight: '480px',
        objectFit: 'contain' as const,
        borderRadius: '6px',
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
    editButton: {
        width: '40px',
        height: '40px',
        borderRadius: '8px',
        border: 'none',
        backgroundColor: '#ede9fe',
        color: '#6366f1',
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
    
    // Multi-select styles
    selectableNoteCard: {
        cursor: 'pointer',
        userSelect: 'none',
    },
    selectedNoteCard: {
        backgroundColor: '#f0f9ff',
        borderColor: '#3b82f6',
        borderWidth: '2px',
        transform: 'scale(0.98)',
    },
    selectionCheckbox: {
        position: 'absolute',
        top: '8px',
        right: '8px',
        zIndex: 10,
    },
    selectedCheckbox: {
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        backgroundColor: '#3b82f6',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '14px',
        fontWeight: 'bold',
    },
    unselectedCheckbox: {
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        border: '2px solid #d1d5db',
        backgroundColor: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    selectionBar: {
        position: 'fixed',
        top: '20px',
        left: '20px',
        right: '20px',
        backgroundColor: '#f8fafc',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        zIndex: 1001,
        border: '1px solid #e2e8f0',
    },
    selectionBarContent: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
    },
    selectionCount: {
        fontSize: '16px',
        fontWeight: '600',
        color: '#1e293b',
    },
    selectionBarActions: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    selectAllButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        backgroundColor: 'transparent',
        border: 'none',
        color: '#6366f1',
        fontSize: '14px',
        fontWeight: '500',
        cursor: 'pointer',
        padding: '4px 8px',
        borderRadius: '6px',
        transition: 'background-color 0.2s ease',
    },
    selectAllIcon: {
        fontSize: '16px',
        color: '#6366f1',
    },
    clearSelectionButton: {
        backgroundColor: 'transparent',
        border: 'none',
        color: '#64748b',
        fontSize: '16px',
        cursor: 'pointer',
        padding: '4px',
        borderRadius: '4px',
        transition: 'color 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '24px',
        height: '24px',
    },
    replayButtonContainer: {
        position: 'fixed',
        bottom: '100px', // Above bottom navigation
        left: '20px',
        right: '20px',
        zIndex: 1000,
    },
    replayButton: {
        width: '100%',
        backgroundColor: '#6366f1',
        color: 'white',
        border: 'none',
        borderRadius: '50px',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        fontSize: '16px',
        fontWeight: '600',
        cursor: 'pointer',
        boxShadow: '0 4px 16px rgba(99, 102, 241, 0.4)',
        transition: 'all 0.2s ease',
    },
    replayButtonIcon: {
        fontSize: '18px',
        color: 'white',
    },
    replayButtonText: {
        fontSize: '16px',
        fontWeight: '600',
        color: 'white',
    },
};

export default ExperiencesPage;
