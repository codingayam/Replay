import React, { useState, useEffect } from 'react';
import MeditationPlayer from '../components/MeditationPlayer';
import ReflectionTypeModal from '../components/ReflectionTypeModal';
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
}

const ReflectionsPage: React.FC = () => {
    const [savedMeditations, setSavedMeditations] = useState<SavedMeditation[]>([]);
    const [isLoadingMeditation, setIsLoadingMeditation] = useState(false);
    const [meditationPlaylist, setMeditationPlaylist] = useState<PlaylistItem[] | null>(null);
    const [expandedSummaries, setExpandedSummaries] = useState<Set<string>>(new Set());
    
    const api = useAuthenticatedApi();
    
    // Stats state
    const [dayStreak, setDayStreak] = useState(0);
    const [monthlyCount, setMonthlyCount] = useState(0);
    const [reflectionDates, setReflectionDates] = useState<string[]>([]);
    const [showCalendarModal, setShowCalendarModal] = useState(false);
    
    // New reflection flow state
    const [showReflectionTypeModal, setShowReflectionTypeModal] = useState(false);
    const [showTimePeriodModal, setShowTimePeriodModal] = useState(false);
    const [showExperienceModal, setShowExperienceModal] = useState(false);
    const [showDurationModal, setShowDurationModal] = useState(false);
    const [showReadyToBeginModal, setShowReadyToBeginModal] = useState(false);
    const [showGenerationModal, setShowGenerationModal] = useState(false);
    const [isGeneratingMeditation, setIsGeneratingMeditation] = useState(false);
    const [isMeditationApiComplete, setIsMeditationApiComplete] = useState(false);
    
    // Reflection session data
    const [selectedReflectionType, setSelectedReflectionType] = useState<'Day' | 'Night'>('Day');
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
        setShowReflectionTypeModal(true);
    };

    const handleReflectionTypeSelection = (type: 'Day' | 'Night') => {
        setSelectedReflectionType(type);
        setShowReflectionTypeModal(false);
        
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
            // Generate meditation with selected experiences and chosen duration
            const response = await api.post('/meditate', {
                noteIds: selectedNoteIds,
                duration: selectedDuration,
                timeOfReflection: selectedReflectionType
            });
            
            setGeneratedPlaylist(response.data.playlist);
            setGeneratedSummary(response.data.summary || '');
            
            // Mark API as complete - loading modal will handle the transition
            console.log('✅ API Success - setting isMeditationApiComplete to true');
            setIsMeditationApiComplete(true);
        } catch (err) {
            console.error("Error generating meditation:", err);
            alert('Failed to generate meditation. Please try again.');
            setIsGeneratingMeditation(false);
            setIsMeditationApiComplete(false);
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
        return <MeditationPlayer playlist={meditationPlaylist} onFinish={handleMeditationFinish} />;
    }

    return (
        <div style={styles.container}>

            {/* Stats Cards */}
            <StatsCards streak={dayStreak} monthlyCount={monthlyCount} />
            
            {/* Recent Activity Calendar */}
            <RecentActivityCalendar 
                reflectionDates={reflectionDates || []}
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

            {/* Recent Reflections Section */}
            <div style={styles.reflectionsSection}>
                <h2 style={styles.sectionTitle}>Recent Reflections</h2>
                {savedMeditations.length > 0 ? (
                    <div style={styles.meditationsList}>
                    {savedMeditations
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
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
                                            {new Date(meditation.created_at).toLocaleDateString()}
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
            <ReflectionTypeModal
                isOpen={showReflectionTypeModal}
                onClose={() => setShowReflectionTypeModal(false)}
                onSelectType={handleReflectionTypeSelection}
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
                onComplete={handleMeditationReady}
                isApiComplete={isMeditationApiComplete}
            />
            
            {/* Calendar Modal */}
            <CalendarModal 
                isOpen={showCalendarModal}
                onClose={() => setShowCalendarModal(false)}
                reflectionDates={reflectionDates || []}
            />
        </div>
    );
};

const styles = {
    container: {
        paddingBottom: '100px', // Space for bottom nav
        paddingTop: '0.75rem',
        paddingLeft: '1rem',
        paddingRight: '1rem',
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