import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import MeditationPlayer from '../components/MeditationPlayer';
import ReplayModeSelectionModal from '../components/ReplayModeSelectionModal';
import MeditationSubTypeModal from '../components/MeditationSubTypeModal';
import TimePeriodModal from '../components/TimePeriodModal';
import ReadyToBeginModal from '../components/ReadyToBeginModal';
import DurationSelectorModal from '../components/DurationSelectorModal';
import ExperienceSelectionModal from '../components/ExperienceSelectionModal';
import MeditationGenerationModal from '../components/MeditationGenerationModal';
import MeditationGeneratingModal from '../components/MeditationGeneratingModal';
import StatsCards from '../components/StatsCards';
import RecentActivityCalendar from '../components/RecentActivityCalendar';
import CalendarModal from '../components/CalendarModal';
import { Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuthenticatedApi } from '../utils/api';
import { useJobs } from '../contexts/JobContext';
import { markMeditationGenerated } from '../utils/notificationUtils';
import { useResponsive } from '../hooks/useResponsive';

interface PlaylistItem {
    type: 'speech' | 'pause';
    audioUrl?: string;
    duration?: number;
}

interface SavedMeditation {
    id: string;
    title: string;
    created_at: string;
    playlist: PlaylistItem[];
    summary?: string;
    is_viewed: boolean;
}

const ReflectionsPage: React.FC = () => {
    const [savedMeditations, setSavedMeditations] = useState<SavedMeditation[]>([]);
    const [isLoadingMeditation, setIsLoadingMeditation] = useState(false);
    const [meditationPlaylist, setMeditationPlaylist] = useState<PlaylistItem[] | null>(null);
    const [currentMeditationId, setCurrentMeditationId] = useState<string | null>(null);
    const [expandedSummaries, setExpandedSummaries] = useState<Set<string>>(new Set());
    
    const api = useAuthenticatedApi();
    const { createJob } = useJobs();
    const { isDesktop } = useResponsive();
    
    // Stats state
    const [dayStreak, setDayStreak] = useState(0);
    const [monthlyCount, setMonthlyCount] = useState(0);
    const [reflectionDates, setReflectionDates] = useState<string[]>([]);
    const [showCalendarModal, setShowCalendarModal] = useState(false);
    
    // New reflection flow state
    const [showReplayModeModal, setShowReplayModeModal] = useState(false);
    const [showMeditationSubTypeModal, setShowMeditationSubTypeModal] = useState(false);
    const [showTimePeriodModal, setShowTimePeriodModal] = useState(false);
    const [showExperienceModal, setShowExperienceModal] = useState(false);
    const [showDurationModal, setShowDurationModal] = useState(false);
    const [showReadyToBeginModal, setShowReadyToBeginModal] = useState(false);
    const [showGenerationModal, setShowGenerationModal] = useState(false);
    const [isGeneratingMeditation, setIsGeneratingMeditation] = useState(false);
    const [isMeditationApiComplete, setIsMeditationApiComplete] = useState(false);
    
    // Reflection session data
    const [selectedReflectionType, setSelectedReflectionType] = useState<'Day' | 'Night' | 'Ideas'>('Day');
    const [selectedStartDate, setSelectedStartDate] = useState('');
    const [selectedEndDate, setSelectedEndDate] = useState('');
    const [selectedDuration, setSelectedDuration] = useState(5);
    const [recommendedDuration, setRecommendedDuration] = useState(5);
    const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
    const [generatedSummary, setGeneratedSummary] = useState<string>('');
    const [generatedPlaylist, setGeneratedPlaylist] = useState<PlaylistItem[] | null>(null);
    

    const fetchSavedMeditations = async () => {
        try {
            const res = await api.get('/meditations');
            setSavedMeditations(res.data.meditations || []);
        } catch (err) {
            console.error("Error fetching meditations:", err);
        }
    };

    const markMeditationAsViewed = async (meditationId: string) => {
        try {
            await api.put(`/meditations/${meditationId}/mark-viewed`);
            // Update the local state to reflect the change
            setSavedMeditations(prev => 
                prev.map(m => 
                    m.id === meditationId ? { ...m, is_viewed: true } : m
                )
            );
        } catch (err) {
            console.error("Error marking meditation as viewed:", err);
        }
    };

    const fetchStats = async () => {
        try {
            const [streakRes, monthlyRes, calendarRes] = await Promise.all([
                api.get('/stats/streak'),
                api.get('/stats/monthly'),
                api.get('/stats/calendar')
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
            const res = await api.get(`/meditations/${meditationId}`);
            setMeditationPlaylist(res.data.playlist);
            setCurrentMeditationId(meditationId);
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
                await api.delete(`/meditations/${meditationId}`);
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
        setShowReplayModeModal(true);
    };

    const handleReplayModeSelection = (mode: 'Casual' | 'Meditative') => {
        setShowReplayModeModal(false);
        
        if (mode === 'Meditative') {
            // Show meditation sub-type modal for meditative mode
            setShowMeditationSubTypeModal(true);
        } else {
            // For Casual mode, set type and continue with time period selection
            setSelectedReflectionType('Casual');
            setShowTimePeriodModal(true);
        }
    };

    const handleMeditationSubTypeSelection = (type: 'Day' | 'Night') => {
        setSelectedReflectionType(type);
        setShowMeditationSubTypeModal(false);
        
        if (type === 'Day') {
            // For Day meditation, go straight to playback
            handlePlayDayReflection();
        } else {
            // For Night reflection, continue with time period selection
            setShowTimePeriodModal(true);
        }
    };

    const handleTimePeriodSelection = (startDate: string, endDate: string) => {
        setSelectedStartDate(startDate);
        setSelectedEndDate(endDate);
        setShowTimePeriodModal(false);
        setShowExperienceModal(true);
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

        try {
            let response;
            
            if (selectedReflectionType === 'Casual') {
                // Generate radio show for casual mode
                console.log('🎙️ Generating radio show...');
                response = await api.post('/replay/radio', {
                    noteIds: selectedNoteIds,
                    duration: selectedDuration,
                    title: `Radio Show - ${new Date().toLocaleDateString()}`
                });
                
                setGeneratedPlaylist(response.data.playlist);
                setGeneratedSummary(response.data.radioShow?.summary || 'Radio talk show replay');
            } else {
                // Generate meditation for meditative mode
                console.log('🧘 Generating meditation...');
                response = await api.post('/meditate', {
                    noteIds: selectedNoteIds,
                    duration: selectedDuration,
                    timeOfReflection: selectedReflectionType,
                    reflectionType: selectedReflectionType
                });
                
                setGeneratedPlaylist(response.data.playlist);
                setGeneratedSummary(response.data.summary || '');
            }
            
            // Mark API as complete - loading modal will handle the transition
            console.log('✅ API Success - setting isMeditationApiComplete to true');
            setIsMeditationApiComplete(true);

            // Mark that user has generated a meditation for notification permission banner
            markMeditationGenerated();
        } catch (err) {
            const errorType = selectedReflectionType === 'Casual' ? 'radio show' : 'meditation';
            console.error(`Error generating ${errorType}:`, err);
            alert(`Failed to generate ${errorType}. Please try again.`);
            setIsGeneratingMeditation(false);
            setIsMeditationApiComplete(false);
        }
    };

    const handleRunInBackground = async () => {
        try {
            console.log('🔄 Starting background meditation generation...');
            
            const jobResponse = await createJob({
                noteIds: selectedNoteIds,
                duration: selectedDuration,
                reflectionType: selectedReflectionType,
                startDate: selectedStartDate,
                endDate: selectedEndDate
            });

            console.log('✅ Background job created:', jobResponse);

            // Mark that user has generated a meditation for notification permission banner
            markMeditationGenerated();

            // Reset state after starting background job
            setSelectedReflectionType('Day');
            setSelectedStartDate('');
            setSelectedEndDate('');
            setSelectedDuration(5);
            setSelectedNoteIds([]);
            setGeneratedSummary('');
            setGeneratedPlaylist(null);

        } catch (error: any) {
            console.error('❌ Failed to start background job:', error);
        }
    };

    const handleMeditationReady = () => {
        console.log('🎯 handleMeditationReady called');
        console.log('📊 generatedPlaylist:', generatedPlaylist);
        
        // Called when the loading animation completes
        setIsGeneratingMeditation(false);
        setIsMeditationApiComplete(false); // Reset for next time
        
        // Only proceed if we actually have a playlist
        if (generatedPlaylist && generatedPlaylist.length > 0) {
            console.log('✅ Valid playlist found, starting meditation');
            setMeditationPlaylist(generatedPlaylist);
        } else {
            console.log('❌ No valid playlist found');
            // If no playlist (API failed), show error and reset
            alert('Meditation generation failed. Please try again when the server is running.');
            // Reset all state
            setSelectedReflectionType('Day');
            setSelectedStartDate('');
            setSelectedEndDate('');
            setSelectedDuration(5);
            setSelectedNoteIds([]);
            setGeneratedSummary('');
            setGeneratedPlaylist(null);
        }
    };

    const handlePlayNow = () => {
        setShowGenerationModal(false);
        setMeditationPlaylist(generatedPlaylist);
    };

    const handleSaveLater = () => {
        setShowGenerationModal(false);
        fetchSavedMeditations(); // Refresh the saved meditations list
        fetchStats(); // Refresh stats since a new meditation was created
        // Reset state
        setSelectedReflectionType('Day');
        setSelectedStartDate('');
        setSelectedEndDate('');
        setSelectedDuration(5);
        setSelectedNoteIds([]);
        setGeneratedSummary('');
        setGeneratedPlaylist(null);
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handleMeditationFinish = (_completed: boolean) => {
        // Ignore completed parameter since we no longer show completion modal
        setMeditationPlaylist(null);
        setCurrentMeditationId(null);
        // Reset all state when meditation finishes
        setSelectedReflectionType('Day');
        setSelectedStartDate('');
        setSelectedEndDate('');
        setSelectedDuration(5);
        setSelectedNoteIds([]);
        setGeneratedSummary('');
        fetchSavedMeditations(); // Refresh the saved meditations list
        fetchStats(); // Refresh stats since meditation was completed
    };

    const handlePlayDayReflection = async () => {
        setIsLoadingMeditation(true);
        try {
            const res = await api.get('/meditations/day/default');
            setMeditationPlaylist(res.data.playlist);
        } catch (err) {
            console.error("Error loading day reflection:", err);
            alert('Failed to load day reflection. Please try again.');
        } finally {
            setIsLoadingMeditation(false);
        }
    };

    const formatDateRange = () => {
        if (!selectedStartDate || !selectedEndDate) return 'Not selected';
        
        const start = new Date(selectedStartDate);
        const end = new Date(selectedEndDate);
        
        if (selectedStartDate === selectedEndDate) {
            return start.toLocaleDateString();
        }
        
        return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
    };


    if (isLoadingMeditation) {
        return (
            <div style={styles.centered}>
                <h2>Loading your meditation...</h2>
                <p>Please wait a moment.</p>
            </div>
        );
    }

    if (meditationPlaylist) {
        return <MeditationPlayer playlist={meditationPlaylist} onFinish={handleMeditationFinish} meditationId={currentMeditationId || undefined} />;
    }

    return (
        <div style={isDesktop ? styles.desktopContainer : styles.container}>
            {/* Header - only show on mobile */}
            {!isDesktop && <Header />}

            {/* Desktop Header */}
            {isDesktop && (
                <div style={styles.desktopHeader}>
                    <div style={styles.desktopHeaderContent}>
                        <div style={styles.desktopTitleSection}>
                            <h1 style={styles.desktopTitle}>Reflections</h1>
                            <p style={styles.desktopSubtitle}>Your completed meditation and reflection sessions</p>
                            <span style={styles.sessionCount}>{savedMeditations.length} sessions</span>
                        </div>
                    </div>
                </div>
            )}

            <div style={isDesktop ? styles.desktopContentContainer : styles.contentContainer}>
                {/* Stats Cards and Calendar - only show on mobile */}
                {!isDesktop && (
                    <>
                        <StatsCards streak={dayStreak} monthlyCount={monthlyCount} />
                        <RecentActivityCalendar
                            reflectionDates={reflectionDates || []}
                            onExpandClick={() => setShowCalendarModal(true)}
                        />
                    </>
                )}
            
            {/* Replay Button */}
            <button 
                onClick={handleStartReflection}
                style={styles.replayButton}
                className="subtle-glow-button"
            >
                <Plus size={20} />
                <span>Replay</span>
            </button>

            {/* Recent Reflections Section */}
            <div style={styles.reflectionsSection}>
                <h2 style={styles.sectionTitle}>Your Reflections</h2>
                {savedMeditations.length > 0 ? (
                    <div style={styles.meditationsList}>
                    {savedMeditations
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                        .map(meditation => {
                        const isExpanded = expandedSummaries.has(meditation.id);
                        return (
                            <div key={meditation.id} style={styles.meditationCard}>
                                <div style={styles.cardHeader} onClick={() => {
                                    toggleSummaryExpansion(meditation.id);
                                    if (!meditation.is_viewed) {
                                        markMeditationAsViewed(meditation.id);
                                    }
                                }}>
                                    <div style={styles.avatarContainer}>
                                        <span style={styles.avatar}>🧘‍♀️</span>
                                    </div>
                                    <div style={styles.cardContent}>
                                        <h3 style={styles.meditationTitle}>{meditation.title}</h3>
                                        <p style={styles.meditationDate}>
                                            {new Date(meditation.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div style={styles.expandIcon}>
                                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </div>
                                    {!meditation.is_viewed && (
                                        <div style={styles.redDotIndicator} />
                                    )}
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
            <ReplayModeSelectionModal
                isOpen={showReplayModeModal}
                onClose={() => setShowReplayModeModal(false)}
                onSelectMode={handleReplayModeSelection}
            />
            
            <MeditationSubTypeModal
                isOpen={showMeditationSubTypeModal}
                onClose={() => setShowMeditationSubTypeModal(false)}
                onSelectType={handleMeditationSubTypeSelection}
            />
            
            <TimePeriodModal
                isOpen={showTimePeriodModal}
                onClose={() => setShowTimePeriodModal(false)}
                onSelectDates={handleTimePeriodSelection}
            />
            
            <ExperienceSelectionModal
                isOpen={showExperienceModal}
                onClose={() => setShowExperienceModal(false)}
                onSelectExperiences={handleExperienceSelection}
                startDate={selectedStartDate}
                endDate={selectedEndDate}
                calculateRecommendedDuration={calculateRecommendedDuration}
                reflectionType={selectedReflectionType}
            />
            
            <DurationSelectorModal
                isOpen={showDurationModal}
                onClose={() => setShowDurationModal(false)}
                onSelectDuration={handleDurationSelection}
                recommendedDuration={recommendedDuration}
            />
            
            <ReadyToBeginModal
                isOpen={showReadyToBeginModal}
                onClose={() => setShowReadyToBeginModal(false)}
                onBack={handleReadyToBeginBack}
                onStart={handleReadyToBeginStart}
                reflectionType={selectedReflectionType}
                period={formatDateRange()}
                experienceCount={selectedNoteIds.length}
                duration={selectedDuration}
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
            
            <MeditationGeneratingModal
                isOpen={isGeneratingMeditation}
                onClose={() => setIsGeneratingMeditation(false)}
                onComplete={handleMeditationReady}
                isApiComplete={isMeditationApiComplete}
                onRunInBackground={handleRunInBackground}
                showBackgroundOption={true}
            />
            
            {/* Calendar Modal */}
            <CalendarModal 
                isOpen={showCalendarModal}
                onClose={() => setShowCalendarModal(false)}
                reflectionDates={reflectionDates || []}
            />
            </div>
        </div>
    );
};

const styles = {
    container: {
        paddingBottom: '100px', // Space for bottom nav
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
    sessionCount: {
        display: 'inline-block',
        padding: '0.25rem 0.75rem',
        backgroundColor: '#ede9fe',
        color: '#6366f1',
        borderRadius: '20px',
        fontSize: '0.875rem',
        fontWeight: '500',
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
    desktopContentContainer: {
        padding: '0',
        backgroundColor: 'transparent',
        borderRadius: '0',
        minHeight: 'auto',
        maxWidth: '100%',
        margin: '0',
        boxSizing: 'border-box',
    },
    replayButton: {
        width: '100%',
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        color: 'white',
        border: 'none',
        borderRadius: '12px',
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        fontSize: '15px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        position: 'relative',
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
        position: 'relative',
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
    redDotIndicator: {
        position: 'absolute',
        top: '12px',
        right: '12px',
        width: '8px',
        height: '8px',
        backgroundColor: '#ef4444',
        borderRadius: '50%',
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