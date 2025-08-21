import React, { useState, useEffect } from 'react';
import axios from 'axios';
import MeditationPlayer from '../components/MeditationPlayer';
import DateSelectorModal from '../components/DateSelectorModal';
import DurationSelectorModal from '../components/DurationSelectorModal';
import ExperienceSelectionModal from '../components/ExperienceSelectionModal';
import ReflectionSummaryModal from '../components/ReflectionSummaryModal';
import MeditationGenerationModal from '../components/MeditationGenerationModal';
import StatsCards from '../components/StatsCards';
import RecentActivityCalendar from '../components/RecentActivityCalendar';
import CalendarModal from '../components/CalendarModal';
import { Plus, ChevronDown, ChevronUp } from 'lucide-react';

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
    
    // Stats state
    const [dayStreak, setDayStreak] = useState(0);
    const [monthlyCount, setMonthlyCount] = useState(0);
    const [reflectionDates, setReflectionDates] = useState<string[]>([]);
    const [showCalendarModal, setShowCalendarModal] = useState(false);
    
    // New reflection flow state
    const [showDateModal, setShowDateModal] = useState(false);
    const [showExperienceModal, setShowExperienceModal] = useState(false);
    const [showDurationModal, setShowDurationModal] = useState(false);
    const [showSummaryModal, setShowSummaryModal] = useState(false);
    const [showGenerationModal, setShowGenerationModal] = useState(false);
    const [isGeneratingMeditation, setIsGeneratingMeditation] = useState(false);
    
    // Reflection session data
    const [selectedStartDate, setSelectedStartDate] = useState('');
    const [selectedEndDate, setSelectedEndDate] = useState('');
    const [selectedTimeOfReflection, setSelectedTimeOfReflection] = useState<'Day' | 'Night'>('Day');
    const [selectedDuration, setSelectedDuration] = useState(5);
    const [recommendedDuration, setRecommendedDuration] = useState(5);
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

    const fetchStats = async () => {
        try {
            const [streakRes, monthlyRes, calendarRes] = await Promise.all([
                axios.get(`${API_URL}/stats/streak`),
                axios.get(`${API_URL}/stats/monthly`),
                axios.get(`${API_URL}/stats/calendar`)
            ]);
            
            setDayStreak(streakRes.data.streak);
            setMonthlyCount(monthlyRes.data.count);
            setReflectionDates(calendarRes.data.dates);
        } catch (err) {
            console.error("Error fetching stats:", err);
        }
    };

    useEffect(() => {
        fetchSavedMeditations();
        fetchStats();
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

    const handleDateSelection = (startDate: string, endDate: string, timeOfReflection: 'Day' | 'Night') => {
        setSelectedStartDate(startDate);
        setSelectedEndDate(endDate);
        setSelectedTimeOfReflection(timeOfReflection);
        setShowDateModal(false);
        
        // For Day reflection, skip experience selection and go directly to pre-saved meditation
        if (timeOfReflection === 'Day') {
            handlePlayDayReflection();
        } else {
            // For Night reflection, continue with normal flow
            setShowExperienceModal(true);
        }
    };


    // Calculate recommended duration based on number of experiences
    const calculateRecommendedDuration = (experienceCount: number): number => {
        if (experienceCount <= 3) return 5;
        if (experienceCount <= 6) return 10;
        if (experienceCount <= 9) return 15;
        return 20;
    };

    const handleExperienceSelection = (noteIds: string[]) => {
        setSelectedNoteIds(noteIds);
        const calculatedDuration = calculateRecommendedDuration(noteIds.length);
        setRecommendedDuration(calculatedDuration);
        setSelectedDuration(calculatedDuration);
        setShowExperienceModal(false);
        setShowDurationModal(true);
    };

    const handleDurationSelection = async (duration: number) => {
        setSelectedDuration(duration);
        setShowDurationModal(false);
        setIsGeneratingMeditation(true);

        try {
            // Generate meditation with selected experiences and chosen duration
            const response = await axios.post(`${API_URL}/meditate`, {
                noteIds: selectedNoteIds,
                duration,
                timeOfReflection: selectedTimeOfReflection
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
        fetchStats(); // Refresh stats since a new meditation was created
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
        fetchStats(); // Refresh stats since meditation was completed
    };

    const handlePlayDayReflection = async () => {
        setIsLoadingMeditation(true);
        try {
            const res = await axios.get(`${API_URL}/meditations/day/default`);
            setMeditationPlaylist(res.data.playlist);
            // Store meditation metadata for summary modal
            setCurrentMeditationMeta({
                noteIds: res.data.noteIds,
                duration: res.data.duration,
                summary: res.data.summary
            });
        } catch (err) {
            console.error("Error loading day reflection:", err);
            alert('Failed to load day reflection. Please try again.');
        } finally {
            setIsLoadingMeditation(false);
        }
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
            {/* Header */}
            <div style={styles.header}>
                <h1 style={styles.appTitle}>Replay</h1>
                <p style={styles.appSubtitle}>Your daily reflections</p>
                
                {/* Stats Cards */}
                <StatsCards streak={dayStreak} monthlyCount={monthlyCount} />
                
                {/* Recent Activity Calendar */}
                <RecentActivityCalendar 
                    reflectionDates={reflectionDates}
                    onExpandClick={() => setShowCalendarModal(true)}
                />
                
                {/* Generate Reflection Button */}
                <button 
                    onClick={handleStartReflection}
                    style={styles.generateButton}
                >
                    <Plus size={20} />
                    <span>Generate Reflection</span>
                </button>
            </div>

            {/* Recent Reflections Section */}
            <div style={styles.reflectionsSection}>
                <h2 style={styles.sectionTitle}>Recent Reflections</h2>
                {savedMeditations.length > 0 ? (
                    <div style={styles.meditationsList}>
                    {savedMeditations
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .map(meditation => {
                        const isExpanded = expandedSummaries.has(meditation.id);
                        return (
                            <div key={meditation.id} style={styles.meditationCard}>
                                <div style={styles.cardHeader} onClick={() => toggleSummaryExpansion(meditation.id)}>
                                    <div style={styles.avatarContainer}>
                                        <span style={styles.avatar}>🧘‍♀️</span>
                                    </div>
                                    <div style={styles.cardContent}>
                                        <h3 style={styles.meditationTitle}>{meditation.title}</h3>
                                        <p style={styles.meditationDate}>
                                            {new Date(meditation.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div style={styles.expandIcon}>
                                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </div>
                                </div>
                                
                                {isExpanded && meditation.summary && (
                                    <div style={styles.expandedContent}>
                                        <p style={styles.summaryText}>{meditation.summary}</p>
                                        <div style={styles.meditationActions}>
                                            <button 
                                                onClick={() => handlePlaySavedMeditation(meditation.id)}
                                                style={styles.playButton}
                                            >
                                                Play
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteSavedMeditation(meditation.id)}
                                                style={styles.deleteButton}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    </div>
                ) : (
                    <div style={styles.emptyState}>
                        <div style={styles.emptyIcon}>🧘‍♀️</div>
                        <h3 style={styles.emptyTitle}>No reflections yet</h3>
                        <p style={styles.emptyText}>
                            Click the "Generate Reflection" button above to create your first personalized reflection session.
                        </p>
                    </div>
                )}
            </div>

            {/* Modals */}
            <DateSelectorModal
                isOpen={showDateModal}
                onClose={() => setShowDateModal(false)}
                onSelectDates={handleDateSelection}
            />
            
            <ExperienceSelectionModal
                isOpen={showExperienceModal}
                onClose={() => setShowExperienceModal(false)}
                onSelectExperiences={handleExperienceSelection}
                startDate={selectedStartDate}
                endDate={selectedEndDate}
                calculateRecommendedDuration={calculateRecommendedDuration}
            />
            
            <DurationSelectorModal
                isOpen={showDurationModal}
                onClose={() => setShowDurationModal(false)}
                onSelectDuration={handleDurationSelection}
                recommendedDuration={recommendedDuration}
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
            
            {/* Calendar Modal */}
            <CalendarModal 
                isOpen={showCalendarModal}
                onClose={() => setShowCalendarModal(false)}
                reflectionDates={reflectionDates}
            />
        </div>
    );
};

const styles = {
    container: {
        backgroundColor: '#f8fafc',
        minHeight: '100vh',
        paddingBottom: '100px', // Space for bottom nav
    },
    header: {
        backgroundColor: 'white',
        padding: '24px',
        borderBottom: '1px solid #e2e8f0',
    },
    appTitle: {
        fontSize: '24px',
        fontWeight: '600',
        color: '#0f172a',
        margin: '0 0 4px 0',
    },
    appSubtitle: {
        fontSize: '14px',
        color: '#64748b',
        margin: '0 0 24px 0',
    },
    generateButton: {
        width: '100%',
        backgroundColor: '#3b82f6',
        color: 'white',
        border: 'none',
        borderRadius: '12px',
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        fontSize: '16px',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'background-color 0.2s ease',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    } as React.CSSProperties,
    reflectionsSection: {
        backgroundColor: 'white',
        padding: '24px',
        borderTop: '1px solid #e2e8f0',
    },
    sectionTitle: {
        fontSize: '18px',
        fontWeight: '600',
        color: '#0f172a',
        margin: '0 0 16px 0',
    },
    meditationsList: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '16px',
    },
    meditationCard: {
        backgroundColor: 'white',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'background-color 0.2s ease',
    },
    cardHeader: {
        display: 'flex',
        alignItems: 'center',
        padding: '16px',
        gap: '12px',
    },
    avatarContainer: {
        width: '40px',
        height: '40px',
        backgroundColor: '#fef3c7',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    avatar: {
        fontSize: '18px',
    },
    cardContent: {
        flex: 1,
        minWidth: 0,
    },
    meditationTitle: {
        fontSize: '16px',
        fontWeight: '500',
        color: '#0f172a',
        margin: '0 0 4px 0',
        lineHeight: 1.3,
    },
    meditationDate: {
        fontSize: '14px',
        color: '#64748b',
        margin: 0,
    },
    expandIcon: {
        color: '#94a3b8',
        flexShrink: 0,
    },
    expandedContent: {
        borderTop: '1px solid #e2e8f0',
        padding: '16px',
        backgroundColor: '#f8fafc',
        animation: 'slideIn 0.2s ease',
    },
    summaryText: {
        fontSize: '14px',
        color: '#475569',
        lineHeight: 1.5,
        margin: '0 0 16px 0',
    },
    meditationActions: {
        display: 'flex',
        gap: '12px',
        justifyContent: 'flex-end',
    },
    playButton: {
        backgroundColor: '#3b82f6',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        padding: '10px 16px',
        fontSize: '14px',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'background-color 0.2s ease',
    },
    deleteButton: {
        backgroundColor: 'transparent',
        color: '#ef4444',
        border: '1px solid #ef4444',
        borderRadius: '8px',
        padding: '10px 16px',
        fontSize: '14px',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
    emptyState: {
        textAlign: 'center' as const,
        padding: '48px 24px',
    },
    emptyIcon: {
        fontSize: '48px',
        marginBottom: '16px',
    },
    emptyTitle: {
        fontSize: '18px',
        fontWeight: '600',
        color: '#0f172a',
        margin: '0 0 8px 0',
    },
    emptyText: {
        fontSize: '14px',
        color: '#64748b',
        lineHeight: 1.5,
        maxWidth: '300px',
        margin: '0 auto',
    },
    centered: {
        textAlign: 'center' as const,
        paddingTop: '64px',
        paddingBottom: '100px',
    },
};

export default ReflectionsPage;