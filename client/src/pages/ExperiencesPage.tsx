import React, { useState, useEffect, useCallback } from 'react';
import type { AxiosError } from 'axios';
import { Trash2, Edit, Image as ImageIcon, Mic, FileText } from 'lucide-react';
import FloatingUploadButton from '../components/FloatingUploadButton';
import SupabaseImage from '../components/SupabaseImage';
import Header from '../components/Header';
import SearchResults from '../components/SearchResults';
import SearchResultModal from '../components/SearchResultModal';
import ReadyToBeginModal from '../components/ReadyToBeginModal';
import MeditationGeneratingModal from '../components/MeditationGeneratingModal';
import MeditationPlayer from '../components/MeditationPlayer';
import EditExperienceModal from '../components/EditExperienceModal';
import type { Note, SearchResult } from '../types';
import { DEFAULT_MEDITATION_TYPE } from '../lib/meditationTypes';

interface PlaylistItem {
    type: 'speech' | 'pause';
    audioUrl?: string;
    duration?: number;
}
import { useAuthenticatedApi } from '../utils/api';
import { groupNotesByDate, sortDateGroups } from '../utils/dateUtils';
import { useResponsive } from '../hooks/useResponsive';
import useWeeklyProgress from '../hooks/useWeeklyProgress';
import { useJobs } from '../contexts/JobContext';
import { compressImage } from '../utils/compressImage';
import { useSubscription } from '../contexts/SubscriptionContext';

const getNoteImages = (note: Note) => {
    if (note.imageUrls && note.imageUrls.length > 0) {
        return note.imageUrls;
    }
    if (note.imageUrl && note.imageUrl.trim().length > 0) {
        return [note.imageUrl];
    }
    return [];
};

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

const toIsoWithCurrentTime = (datePart: string) => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    return new Date(`${datePart}T${hours}:${minutes}:${seconds}`).toISOString();
};

const DEFAULT_DURATION_MINUTES = 5;

const ExperiencesPage: React.FC = () => {
    const [notes, setNotes] = useState<Note[]>([]);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [isUploadingText, setIsUploadingText] = useState(false);
    const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
    const [noteImageSelections, setNoteImageSelections] = useState<Record<string, number>>({});
    
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
    
    // Meditative replay state
    const [showReadyToBeginModal, setShowReadyToBeginModal] = useState(false);
    const [showMeditationGeneratingModal, setShowMeditationGeneratingModal] = useState(false);
    const [meditationPlaylist, setMeditationPlaylist] = useState<PlaylistItem[] | null>(null);
    const [currentMeditationId, setCurrentMeditationId] = useState<string | null>(null);
    const api = useAuthenticatedApi();
    const { isDesktop } = useResponsive();
    const { refresh: refreshWeeklyProgress } = useWeeklyProgress();
    const { createJob } = useJobs();
    const { isPremium, meditations, journals, showPaywall, refresh: refreshSubscription } = useSubscription();
    const remainingMeditations = meditations?.remaining ?? null;
    const meditationLimit = meditations?.limit ?? null;
    const remainingJournals = journals?.remaining ?? null;
    const journalLimit = journals?.limit ?? null;
    
    const fetchNotes = useCallback(async () => {
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
    }, [api]);

    useEffect(() => {
        fetchNotes();
    }, [fetchNotes]);

    const normalizeNoteDate = (value?: string) => {
        if (!value) {
            return new Date().toISOString();
        }

        if (dateOnlyPattern.test(value)) {
            return toIsoWithCurrentTime(value);
        }

        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            return new Date().toISOString();
        }
        return parsed.toISOString();
    };

    const handleSaveAudioNote = async (blob: Blob, noteDate?: string) => {
        const normalizedDate = normalizeNoteDate(noteDate);
        const formData = new FormData();
        formData.append('audio', blob, 'recording.wav');
        formData.append('date', normalizedDate);
        formData.append('localTimestamp', normalizedDate);
        try {
            await api.post('/notes', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            fetchNotes();
            await refreshWeeklyProgress();
            await refreshSubscription({ force: true });
        } catch (err) {
            const axiosError = err as AxiosError<{ message?: string; code?: string }>;
            if (axiosError.response?.status === 402) {
                const message = axiosError.response.data?.message || 'Upgrade to Replay Premium to continue journaling.';
                alert(message);
                showPaywall();
                await refreshSubscription({ force: true });
            } else {
                console.error("Error saving audio note:", err);
                alert('Failed to save audio note. See console for details.');
            }
        }
    };

    const handleSavePhotoNote = async (files: File[], caption: string, noteDate?: string) => {
        setIsUploadingPhoto(true);
        try {
            const formData = new FormData();
            const optimizedImages = await Promise.all(files.map(async (image) => compressImage(image)));

            optimizedImages.forEach((optimizedImage) => {
                formData.append('images', optimizedImage);
            });

            formData.append('caption', caption);
            const normalizedDate = normalizeNoteDate(noteDate);
            formData.append('date', normalizedDate);
            formData.append('localTimestamp', normalizedDate);

            await api.post('/notes/photo', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            fetchNotes();
            await refreshWeeklyProgress();
            await refreshSubscription({ force: true });
        } catch (err) {
            const axiosError = err as AxiosError<{ message?: string; code?: string }>;
            if (axiosError.response?.status === 402) {
                const message = axiosError.response.data?.message || 'Upgrade to Replay Premium to continue journaling.';
                alert(message);
                showPaywall();
                await refreshSubscription({ force: true });
            } else {
                console.error('Error saving photo note:', err);
                alert('Failed to save photo note. See console for details.');
            }
        } finally {
            setIsUploadingPhoto(false);
        }
    };

    const handleSaveTextNote = async (title: string, content: string, images: File[], noteDate?: string) => {
        setIsUploadingText(true);
        try {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('content', content);
            const normalizedDate = normalizeNoteDate(noteDate);
            formData.append('date', normalizedDate);
            formData.append('localTimestamp', normalizedDate);

            if (images.length) {
                const optimizedImages = await Promise.all(images.map(async (image) => compressImage(image)));
                optimizedImages.forEach((optimizedImage) => {
                    formData.append('images', optimizedImage);
                });
            }

            await api.post('/notes/text', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            fetchNotes();
            await refreshWeeklyProgress();
            await refreshSubscription({ force: true });
        } catch (err) {
            const axiosError = err as AxiosError<{ message?: string; code?: string }>;
            if (axiosError.response?.status === 402) {
                const message = axiosError.response.data?.message || 'Upgrade to Replay Premium to continue journaling.';
                alert(message);
                showPaywall();
                await refreshSubscription({ force: true });
            } else {
                console.error('Error saving text note:', err);
                alert('Failed to save text note. See console for details.');
            }
        } finally {
            setIsUploadingText(false);
        }
    };

    const handleDeleteNote = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this note?')) {
            try {
                await api.delete(`/notes/${id}`);
                fetchNotes();
                await refreshWeeklyProgress();
            } catch (err) {
                console.error("Error deleting note:", err);
            }
        }
    };

    const handleDeleteNoteFromSearch = async (id: string) => {
        try {
            await api.delete(`/notes/${id}`);
            fetchNotes();
            await refreshWeeklyProgress();
            // Refresh search results if there's an active search
            if (searchActive && searchQuery) {
                handleSearch(searchQuery);
            }
        } catch (err) {
            console.error("Error deleting note:", err);
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
            if (searchActive && searchQuery.trim()) {
                handleSearch(searchQuery);
            }
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

    const renderNoteImages = (note: Note) => {
        const images = getNoteImages(note);
        if (!images.length) {
            return null;
        }
        const activeIndex = Math.min(noteImageSelections[note.id] ?? 0, images.length - 1);
        const activeImage = images[activeIndex] ?? images[0];

        return (
            <div style={styles.photoContainer}>
                <div style={styles.photoPlaceholder}>
                    <SupabaseImage
                        src={activeImage}
                        alt={note.userTitle || note.title}
                        style={styles.photo}
                    />
                </div>
                {images.length > 1 && (
                    <div style={styles.photoThumbnailRow}>
                        {images.map((imageUrl, index) => (
                            <button
                                key={`${note.id}-gallery-${index}`}
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setNoteImageSelections((prev) => ({
                                        ...prev,
                                        [note.id]: index
                                    }));
                                }}
                                style={{
                                    ...styles.photoThumbnailButton,
                                    ...(index === activeIndex ? styles.activePhotoThumbnailButton : {})
                                }}
                                aria-label={`View photo ${index + 1}`}
                            >
                                <SupabaseImage
                                    src={imageUrl}
                                    alt={`${note.title} thumbnail ${index + 1}`}
                                    style={styles.photoThumbnail}
                                />
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
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

    const handleEditNoteFromSearch = (note: Note) => {
        handleEditNote(note);
        setModalOpen(false);
        setSelectedNoteId(null);
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
        if (selectedNoteIds.size === 0) {
            return;
        }
        if (!isPremium && meditations && meditations.remaining <= 0) {
            alert('You have used all free meditations on the Replay free plan. Upgrade to Replay Premium for unlimited sessions.');
            showPaywall();
            return;
        }
        setShowReadyToBeginModal(true);
    };

    // Meditative replay modal handlers
    const handleReadyToBeginBack = () => {
        setShowReadyToBeginModal(false);
    };

    const handleReadyToBeginStart = async () => {
        setShowReadyToBeginModal(false);
        setShowMeditationGeneratingModal(true);

        try {
            console.log('🧘 Queuing background meditation job from selected experiences...');
            const jobResponse = await createJob({
                noteIds: Array.from(selectedNoteIds),
                reflectionType: DEFAULT_MEDITATION_TYPE
            });

            console.log('✅ Background job queued:', jobResponse);

            setShowMeditationGeneratingModal(false);
            setMeditationPlaylist(null);
            setCurrentMeditationId(null);
            handleClearSelection();
            await refreshSubscription({ force: true });

            alert('Your meditation is being generated in the background. We’ll notify you when it is ready.');
        } catch (err) {
            const axiosError = err as AxiosError<{ message?: string; code?: string }>;
            if (axiosError.response?.status === 402) {
                const message = axiosError.response.data?.message || 'Upgrade to Replay Premium to continue generating meditations.';
                alert(message);
                showPaywall();
                await refreshSubscription({ force: true });
            } else {
                console.error('Error queuing meditation job:', err);
                alert('Failed to start meditation generation. Please try again.');
            }
            setShowMeditationGeneratingModal(false);
        }
    };

    const handleMeditationReady = () => {
        console.log('🎯 handleMeditationReady called – background job still in progress.');
        setShowMeditationGeneratingModal(false);
    };

    const handleMeditationFinish = async (completed: boolean) => {
        console.log(`🎯 Meditation finished - completed: ${completed}`);
        setMeditationPlaylist(null);
        setCurrentMeditationId(null);
        
        // Clear selection and exit selection mode
        handleClearSelection();
        await refreshWeeklyProgress();
    };

    // Group notes by date categories
    const groupedNotes = groupNotesByDate(notes);
    const sortedDateGroups = sortDateGroups(Object.keys(groupedNotes));

    // Show meditation player if we have a playlist
    if (meditationPlaylist) {
        return <MeditationPlayer playlist={meditationPlaylist} onFinish={handleMeditationFinish} meditationId={currentMeditationId || undefined} />;
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
                    {sortedDateGroups.map((dateGroup) => {
                        const groupNotes = groupedNotes[dateGroup].sort((a, b) => 
                            new Date(b.date).getTime() - new Date(a.date).getTime()
                        );
                        
                        return (
                            <div key={dateGroup} style={styles.dateGroup}>
                                {/* Date category header */}
                                <h2 style={styles.dateHeader}>{dateGroup}</h2>
                                
                                {groupNotes.map((note) => {
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
                                                            </div>
                                                        ) : note.type === 'text' ? (
                                                            <div>
                                                                {/* Optional image for text notes */}
                                                                {renderNoteImages(note)}
                                                                <div style={styles.transcript}>
                                                                    <p style={styles.transcriptText}>
                                                                        {note.transcript}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div>
                                                                {/* Photo notes */}
                                                                {renderNoteImages(note)}
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

    {!isPremium && typeof remainingJournals === 'number' && (
        <div style={styles.journalLimitNotice}>
            <span>
                {remainingJournals > 0
                    ? `You have ${remainingJournals} of ${journalLimit ?? 10} free journal${remainingJournals === 1 ? '' : 's'} remaining.`
                    : 'You have used all free journals.'}
            </span>
            <button type="button" style={styles.inlineUpsellLink} onClick={showPaywall}>
                Subscribe to Replay Premium today to unlock unlimited usage
            </button>
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
                onDelete={handleDeleteNoteFromSearch}
                onEdit={handleEditNoteFromSearch}
            />

            {/* Selection Bar */}
            {selectionMode && !showReadyToBeginModal && !showMeditationGeneratingModal && (
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
                    {!isPremium && meditations && (
                        <div style={styles.replayInfoRow}>
                            <p style={styles.meditationCreditText}>
                                <span>
                                    {typeof remainingMeditations === 'number'
                                        ? (remainingMeditations > 0
                                            ? `You have ${remainingMeditations} of ${meditationLimit ?? 2} free meditation${remainingMeditations === 1 ? '' : 's'} remaining.`
                                            : 'You have used all free meditations.')
                                        : 'Checking your free balance...'}
                                </span>
                                {' '}
                                <button type="button" style={styles.inlineUpsellLink} onClick={showPaywall}>
                                    Subscribe to Replay Premium today to unlock unlimited usage
                                </button>
                            </p>
                            {typeof remainingMeditations === 'number' && remainingMeditations <= 0 && (
                                <button type="button" style={styles.upgradeLinkButton} onClick={showPaywall}>
                                    Unlock Premium
                                </button>
                            )}
                        </div>
                    )}
                    <button 
                        onClick={handleGenerateFromSelection}
                        style={styles.replayButton}
                    >
                        <span style={styles.replayButtonIcon}>⚙</span>
                        <span style={styles.replayButtonText}>Replay ({selectedNoteIds.size} experiences)</span>
                    </button>
                </div>
            )}
            {/* Ready to Begin Modal */}
            <ReadyToBeginModal
                isOpen={showReadyToBeginModal}
                onClose={() => setShowReadyToBeginModal(false)}
                onBack={handleReadyToBeginBack}
                onStart={handleReadyToBeginStart}
                reflectionType={DEFAULT_MEDITATION_TYPE}
                period="Selected Experiences"
                experienceCount={selectedNoteIds.size}
                duration={DEFAULT_DURATION_MINUTES}
                extraContent={isPremium
                    ? <span>You’re on Replay Premium—enjoy unlimited meditation generations.</span>
                    : (
                        <div>
                            <p style={{ margin: 0 }}>
                                <span>
                                    {typeof remainingMeditations === 'number'
                                        ? (remainingMeditations > 0
                                            ? `You have ${remainingMeditations} of ${meditationLimit ?? 2} free meditation${remainingMeditations === 1 ? '' : 's'} remaining.`
                                            : 'You have used all free meditations.')
                                        : 'Checking your free balance...'}
                                </span>
                                {' '}
                                <button type="button" style={styles.inlineUpsellLink} onClick={showPaywall}>
                                    Subscribe to Replay Premium today to unlock unlimited usage
                                </button>
                            </p>
                            {typeof remainingMeditations === 'number' && remainingMeditations <= 0 && (
                                <button
                                    type="button"
                                    onClick={showPaywall}
                                    style={{
                                        marginTop: '0.75rem',
                                        border: 'none',
                                        borderRadius: '999px',
                                        padding: '0.5rem 1.1rem',
                                        backgroundColor: 'var(--primary-color)',
                                        color: '#fff',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Upgrade to Premium
                                </button>
                            )}
                        </div>
                    )}
            />

            {/* Meditation Generating Modal */}
            <MeditationGeneratingModal
                isOpen={showMeditationGeneratingModal}
                onClose={() => setShowMeditationGeneratingModal(false)}
                onComplete={handleMeditationReady}
                onRunInBackground={() => {
                    setShowMeditationGeneratingModal(false);
                    alert('Your meditation will keep generating in the background.');
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
    journalLimitNotice: {
        margin: '1rem 1rem 0',
        padding: '0.75rem 1rem',
        backgroundColor: '#eef2ff',
        color: '#4338ca',
        borderRadius: '12px',
        fontSize: '0.95rem',
        fontWeight: 500,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '0.35rem',
    },
    inlineUpsellLink: {
        background: 'none',
        border: 'none',
        padding: 0,
        margin: 0,
        fontSize: '0.9rem',
        color: '#6366f1',
        textDecoration: 'underline',
        cursor: 'pointer',
        alignSelf: 'center',
        display: 'inline'
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
    photoThumbnailRow: {
        display: 'flex',
        flexWrap: 'wrap' as const,
        gap: '0.5rem',
        marginTop: '0.5rem',
    },
    photoThumbnailButton: {
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: '6px',
        padding: 0,
        cursor: 'pointer',
        background: '#fff',
        lineHeight: 0,
        transition: 'border-color 0.2s ease, transform 0.2s ease',
    },
    activePhotoThumbnailButton: {
        borderColor: 'var(--primary-color)',
        transform: 'scale(1.03)',
        boxShadow: '0 0 0 2px rgba(0, 118, 255, 0.15)',
    },
    photoThumbnail: {
        width: '56px',
        height: '56px',
        borderRadius: '6px',
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
    replayInfoRow: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        marginBottom: '0.75rem',
        background: 'rgba(99, 102, 241, 0.1)',
        borderRadius: '16px',
        padding: '0.9rem 1rem'
    },
    meditationCreditText: {
        margin: 0,
        color: '#312e81',
        fontSize: '0.95rem',
        fontWeight: 600
    },
    meditationResetText: {
        color: '#4338ca',
        fontWeight: 500,
        fontSize: '0.9rem'
    },
    upgradeLinkButton: {
        alignSelf: 'flex-start',
        border: 'none',
        background: 'var(--primary-color)',
        color: '#fff',
        borderRadius: '999px',
        padding: '0.45rem 1rem',
        fontWeight: 600,
        cursor: 'pointer'
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
