import React, { useState, useEffect } from 'react';
import axios from 'axios';
import MeditationPlayer from '../components/MeditationPlayer';
import DateSelectorModal from '../components/DateSelectorModal';
import DurationSelectorModal from '../components/DurationSelectorModal';
import ExperienceSelectionModal from '../components/ExperienceSelectionModal';
import ReflectionSummaryModal from '../components/ReflectionSummaryModal';
import MeditationGenerationModal from '../components/MeditationGenerationModal';
import { Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

const API_URL = '/api';

interface PlaylistItem {
    type: 'speech' | 'pause';
    audioUrl?: string;
    duration?: number;
}

interface SavedMeditation {
    id: string;
    title: string;
    createdAt: string;
    noteIds: string[];
    summary?: string;
}

const ReflectionsPage: React.FC = () => {
    const [savedMeditations, setSavedMeditations] = useState<SavedMeditation[]>([]);
    const [isLoadingMeditation, setIsLoadingMeditation] = useState(false);
    const [meditationPlaylist, setMeditationPlaylist] = useState<PlaylistItem[] | null>(null);
    const [expandedSummaries, setExpandedSummaries] = useState<Set<string>>(new Set());
    
    // New reflection flow state
    const [showDateModal, setShowDateModal] = useState(false);
    const [showDurationModal, setShowDurationModal] = useState(false);
    const [showExperienceModal, setShowExperienceModal] = useState(false);
    const [showSummaryModal, setShowSummaryModal] = useState(false);
    const [showGenerationModal, setShowGenerationModal] = useState(false);
    const [isGeneratingMeditation, setIsGeneratingMeditation] = useState(false);
    
    // Reflection session data
    const [selectedStartDate, setSelectedStartDate] = useState('');
    const [selectedEndDate, setSelectedEndDate] = useState('');
    const [selectedDuration, setSelectedDuration] = useState(5);
    const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
    const [generatedSummary, setGeneratedSummary] = useState<string>('');
    const [generatedPlaylist, setGeneratedPlaylist] = useState<PlaylistItem[] | null>(null);
    
    // Current playing meditation metadata (for saved meditations)
    const [currentMeditationMeta, setCurrentMeditationMeta] = useState<{
        noteIds: string[];
        duration: number;
        summary: string;
    } | null>(null);

    const fetchSavedMeditations = async () => {
        try {
            const res = await axios.get(`${API_URL}/meditations`);
            setSavedMeditations(res.data);
        } catch (err) {
            console.error("Error fetching meditations:", err);
        }
    };

    useEffect(() => {
        fetchSavedMeditations();
    }, []);

    const handlePlaySavedMeditation = async (meditationId: string) => {
        setIsLoadingMeditation(true);
        try {
            const res = await axios.get(`${API_URL}/meditations/${meditationId}`);
            setMeditationPlaylist(res.data.playlist);
            // Store meditation metadata for summary modal
            setCurrentMeditationMeta({
                noteIds: res.data.noteIds,
                duration: res.data.duration,
                summary: res.data.summary
            });
        } catch (err) {
            console.error("Error loading meditation:", err);
            alert('Failed to load meditation. Please try again.');
        } finally {
            setIsLoadingMeditation(false);
        }
    };

    const handleDeleteSavedMeditation = async (meditationId: string) => {
        if (window.confirm('Are you sure you want to delete this meditation?')) {
            try {
                await axios.delete(`${API_URL}/meditations/${meditationId}`);
                fetchSavedMeditations();
            } catch (err) {
                console.error("Error deleting meditation:", err);
                alert('Failed to delete meditation. Please try again.');
            }
        }
    };

    const toggleSummaryExpansion = (meditationId: string) => {
        setExpandedSummaries(prev => {
            const newSet = new Set(prev);
            if (newSet.has(meditationId)) {
                newSet.delete(meditationId);
            } else {
                newSet.add(meditationId);
            }
            return newSet;
        });
    };

    // New reflection flow handlers
    const handleStartReflection = () => {
        setShowDateModal(true);
    };

    const handleDateSelection = (startDate: string, endDate: string) => {
        setSelectedStartDate(startDate);
        setSelectedEndDate(endDate);
        setShowDateModal(false);
        setShowDurationModal(true);
    };

    const handleDurationSelection = (duration: number) => {
        setSelectedDuration(duration);
        setShowDurationModal(false);
        setShowExperienceModal(true);
    };

    const handleExperienceSelection = async (noteIds: string[]) => {
        setSelectedNoteIds(noteIds);
        setShowExperienceModal(false);
        setIsGeneratingMeditation(true);

        try {
            // Generate meditation with selected experiences and duration
            const response = await axios.post(`${API_URL}/meditate`, {
                noteIds,
                duration: selectedDuration
            });
            
            setGeneratedPlaylist(response.data.playlist);
            setGeneratedSummary(response.data.summary || '');
            setShowGenerationModal(true);
        } catch (err) {
            console.error("Error generating meditation:", err);
            alert('Failed to generate meditation. Please try again.');
        } finally {
            setIsGeneratingMeditation(false);
        }
    };

    const handlePlayNow = () => {
        setShowGenerationModal(false);
        setMeditationPlaylist(generatedPlaylist);
        // Store current session metadata for summary modal
        setCurrentMeditationMeta({
            noteIds: selectedNoteIds,
            duration: selectedDuration,
            summary: generatedSummary
        });
    };

    const handleSaveLater = () => {
        setShowGenerationModal(false);
        fetchSavedMeditations(); // Refresh the saved meditations list
        // Reset state
        setSelectedStartDate('');
        setSelectedEndDate('');
        setSelectedDuration(5);
        setSelectedNoteIds([]);
        setGeneratedSummary('');
        setGeneratedPlaylist(null);
    };

    const handleMeditationFinish = (completed: boolean) => {
        setMeditationPlaylist(null);
        if (completed) {
            setShowSummaryModal(true);
        }
        fetchSavedMeditations(); // Refresh the saved meditations list
    };

    const handleSummaryClose = () => {
        setShowSummaryModal(false);
        // Reset all state
        setSelectedStartDate('');
        setSelectedEndDate('');
        setSelectedDuration(5);
        setSelectedNoteIds([]);
        setGeneratedSummary('');
        setCurrentMeditationMeta(null);
    };

    if (isLoadingMeditation || isGeneratingMeditation) {
        return (
            <div style={styles.centered}>
                <h2>{isGeneratingMeditation ? 'Creating your reflection...' : 'Loading your meditation...'}</h2>
                <p>Please wait a moment.</p>
            </div>
        );
    }

    if (meditationPlaylist) {
        return <MeditationPlayer playlist={meditationPlaylist} onFinish={handleMeditationFinish} />;
    }

    return (
        <div style={styles.container}>
            {/* Reflect Button */}
            <div style={styles.reflectSection}>
                <button 
                    onClick={handleStartReflection}
                    style={styles.reflectButton}
                    className="btn-primary"
                >
                    <Sparkles size={20} />
                    <span>Reflect</span>
                </button>
                <p style={styles.reflectDescription}>
                    Create a personalized meditation from your recent experiences
                </p>
            </div>

            {savedMeditations.length > 0 ? (
                <div style={styles.meditationsList}>
                    {savedMeditations
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .map(meditation => {
                        const isExpanded = expandedSummaries.has(meditation.id);
                        return (
                            <div key={meditation.id} className="card-enhanced" style={styles.meditationCard}>
                                <div style={styles.meditationContent}>
                                    <h3 style={styles.meditationTitle}>{meditation.title}</h3>
                                    <p style={styles.meditationDate}>
                                        {new Date(meditation.createdAt).toLocaleDateString()} at {new Date(meditation.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                    <p style={styles.meditationNotes}>
                                        Based on {meditation.noteIds.length} experience{meditation.noteIds.length !== 1 ? 's' : ''}
                                    </p>
                                    
                                    {meditation.summary && (
                                        <div style={styles.summarySection}>
                                            <button 
                                                onClick={() => toggleSummaryExpansion(meditation.id)}
                                                style={styles.summaryToggle}
                                            >
                                                <span>Reflection Summary</span>
                                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                            </button>
                                            
                                            {isExpanded && (
                                                <div style={styles.summaryContent}>
                                                    <p style={styles.summaryText}>{meditation.summary}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div style={styles.meditationActions}>
                                    <button 
                                        onClick={() => handlePlaySavedMeditation(meditation.id)}
                                        className="btn-primary"
                                        style={styles.playButton}
                                    >
                                        Play
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteSavedMeditation(meditation.id)}
                                        className="btn-secondary"
                                        style={styles.deleteButton}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div style={styles.emptyState}>
                    <div style={styles.emptyIcon}>🧘‍♀️</div>
                    <h3 style={styles.emptyTitle}>No reflections yet</h3>
                    <p style={styles.emptyText}>
                        Click the "Reflect" button above to create your first personalized reflection session.
                    </p>
                </div>
            )}

            {/* Modals */}
            <DateSelectorModal
                isOpen={showDateModal}
                onClose={() => setShowDateModal(false)}
                onSelectDates={handleDateSelection}
            />
            
            <DurationSelectorModal
                isOpen={showDurationModal}
                onClose={() => setShowDurationModal(false)}
                onSelectDuration={handleDurationSelection}
            />
            
            <ExperienceSelectionModal
                isOpen={showExperienceModal}
                onClose={() => setShowExperienceModal(false)}
                onSelectExperiences={handleExperienceSelection}
                startDate={selectedStartDate}
                endDate={selectedEndDate}
                duration={selectedDuration}
            />
            
            <ReflectionSummaryModal
                isOpen={showSummaryModal}
                onClose={handleSummaryClose}
                noteIds={currentMeditationMeta?.noteIds || selectedNoteIds}
                duration={currentMeditationMeta?.duration || selectedDuration}
                preGeneratedSummary={currentMeditationMeta?.summary || generatedSummary}
            />
            
            <MeditationGenerationModal
                isOpen={showGenerationModal}
                onClose={() => setShowGenerationModal(false)}
                onPlayNow={handlePlayNow}
                onSaveLater={handleSaveLater}
                duration={selectedDuration}
                noteCount={selectedNoteIds.length}
                summary={generatedSummary}
            />
        </div>
    );
};

const styles = {
    container: {
        paddingBottom: '100px', // Space for bottom nav
        paddingTop: '1rem', // Space after Instagram-style header
    },
    reflectSection: {
        textAlign: 'center' as const,
        marginBottom: '2rem',
        padding: '1.5rem 0',
    },
    reflectButton: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        padding: '1rem 2rem',
        fontSize: '1.1rem',
        fontWeight: '600',
        cursor: 'pointer',
        borderRadius: '12px',
        border: 'none',
        background: 'var(--gradient-primary)',
        color: 'white',
        margin: '0 auto',
        minWidth: '140px',
        boxShadow: 'var(--shadow-md)',
        transition: 'all 0.3s ease',
    },
    reflectDescription: {
        fontSize: '0.9rem',
        color: 'var(--text-secondary)',
        maxWidth: '280px',
        margin: '0.75rem auto 0 auto',
        lineHeight: 1.4,
    },
    meditationsList: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '1.25rem',
    },
    meditationCard: { 
        padding: '1.5rem',
    },
    meditationContent: { 
        marginBottom: '1rem',
    },
    meditationTitle: { 
        margin: '0 0 0.5rem 0', 
        fontSize: '1.1rem', 
        fontWeight: '600',
        color: 'var(--text-color)',
    },
    meditationDate: { 
        margin: '0 0 0.5rem 0', 
        color: '#666', 
        fontSize: '0.85rem',
    },
    meditationNotes: { 
        margin: 0, 
        color: 'var(--primary-color)', 
        fontSize: '0.85rem',
        fontWeight: '500',
    },
    meditationActions: { 
        display: 'flex', 
        gap: '0.75rem',
        justifyContent: 'flex-end',
    },
    playButton: { 
        padding: '0.875rem 1.5rem', 
        fontSize: '0.95rem',
        cursor: 'pointer',
    },
    deleteButton: { 
        padding: '0.875rem 1.5rem', 
        fontSize: '0.95rem',
        cursor: 'pointer',
        border: '2px solid var(--error-color)',
        color: 'var(--error-color)',
        background: 'transparent',
    },
    summarySection: {
        marginTop: '1rem',
        borderTop: '1px solid var(--card-border)',
        paddingTop: '1rem',
    },
    summaryToggle: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '0.75rem',
        background: 'var(--card-border)',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '0.9rem',
        fontWeight: '500',
        color: 'var(--text-color)',
        transition: 'background-color 0.2s',
    },
    summaryContent: {
        marginTop: '0.75rem',
        padding: '1rem',
        backgroundColor: 'rgba(var(--primary-color-rgb), 0.05)',
        borderRadius: '8px',
        border: '1px solid rgba(var(--primary-color-rgb), 0.1)',
    },
    summaryText: {
        margin: 0,
        fontSize: '0.9rem',
        color: 'var(--text-color)',
        lineHeight: 1.5,
        fontStyle: 'italic',
    },
    emptyState: {
        textAlign: 'center' as const,
        marginTop: '3rem',
        padding: '2rem',
    },
    emptyIcon: {
        fontSize: '3rem',
        marginBottom: '1rem',
    },
    emptyTitle: {
        color: 'var(--text-color)',
        marginBottom: '1rem',
        fontSize: '1.3rem',
    },
    emptyText: {
        color: '#666',
        fontSize: '1rem',
        lineHeight: 1.5,
        maxWidth: '300px',
        margin: '0 auto',
    },
    centered: { 
        textAlign: 'center' as const, 
        paddingTop: '4rem',
        paddingBottom: '100px',
    },
};

export default ReflectionsPage;