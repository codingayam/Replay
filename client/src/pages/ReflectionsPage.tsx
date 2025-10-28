import React, { useState, useEffect } from 'react';
import type { AxiosError } from 'axios';
import Header from '../components/Header';
import MeditationPlayer from '../components/MeditationPlayer';
import MeditationSubTypeModal from '../components/MeditationSubTypeModal';
import TimePeriodModal from '../components/TimePeriodModal';
import ReadyToBeginModal from '../components/ReadyToBeginModal';
import ExperienceSelectionModal from '../components/ExperienceSelectionModal';
import MeditationGenerationModal from '../components/MeditationGenerationModal';
import MeditationGeneratingModal from '../components/MeditationGeneratingModal';
import RecentActivityCalendar from '../components/RecentActivityCalendar';
import CalendarModal from '../components/CalendarModal';
import WeeklyProgressCard from '../components/WeeklyProgressCard';
import LotusFlowerButton from '../components/LotusFlowerButton';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useAuthenticatedApi } from '../utils/api';
import { useJobs } from '../contexts/JobContext';
import { useResponsive } from '../hooks/useResponsive';
import useWeeklyProgress from '../hooks/useWeeklyProgress';
import { useSubscription } from '../contexts/SubscriptionContext';
import { DEFAULT_MEDITATION_TYPE, type MeditationTypeSlug } from '../lib/meditationTypes';

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
    duration?: number;
    audioExpiresAt?: string | null;
    audioRemovedAt?: string | null;
    isAudioAvailable?: boolean;
    audioSecondsRemaining?: number;
}

type ApiMeditation = SavedMeditation & {
    audio_expires_at?: string | null;
    audio_removed_at?: string | null;
    is_audio_available?: boolean;
    audio_seconds_remaining?: number;
};

const DEFAULT_DURATION_MINUTES = 5;

const ReflectionsPage: React.FC = () => {
    const [savedMeditations, setSavedMeditations] = useState<SavedMeditation[]>([]);
    const [isLoadingMeditation, setIsLoadingMeditation] = useState(false);
    const [meditationPlaylist, setMeditationPlaylist] = useState<PlaylistItem[] | null>(null);
    const [currentMeditationId, setCurrentMeditationId] = useState<string | null>(null);
    const [expandedSummaries, setExpandedSummaries] = useState<Set<string>>(new Set());
    
    const api = useAuthenticatedApi();
    const { createJob } = useJobs();
    const { isDesktop } = useResponsive();
    const { isPremium, meditations, showPaywall, refresh: refreshSubscription } = useSubscription();
    const remainingMeditations = meditations?.remaining ?? null;
    const meditationLimit = meditations?.limit ?? null;
    const {
        summary: weeklyProgress,
        thresholds: progressThresholds,
        weekStart: progressWeekStart,
        timezone: progressTimezone,
        isLoading: isProgressLoading,
        error: progressError,
        refresh: refreshWeeklyProgress
    } = useWeeklyProgress();
    const journalGoal = progressThresholds?.weeklyJournals ?? 3;
    const meditationGoal = progressThresholds?.weeklyMeditations ?? 1;
    
    const [activityDates, setActivityDates] = useState<{ journals: string[]; reflections: string[] }>({ journals: [], reflections: [] });
    const [showCalendarModal, setShowCalendarModal] = useState(false);
    
    // New reflection flow state
    const [showMeditationSubTypeModal, setShowMeditationSubTypeModal] = useState(false);
    const [showTimePeriodModal, setShowTimePeriodModal] = useState(false);
    const [showExperienceModal, setShowExperienceModal] = useState(false);
    const [showReadyToBeginModal, setShowReadyToBeginModal] = useState(false);
    const [showGenerationModal, setShowGenerationModal] = useState(false);
    const [isGeneratingMeditation, setIsGeneratingMeditation] = useState(false);
    const [isMeditationApiComplete, setIsMeditationApiComplete] = useState(false);
    
    // Reflection session data
    const [selectedReflectionType, setSelectedReflectionType] = useState<MeditationTypeSlug>(DEFAULT_MEDITATION_TYPE);
    const [selectedStartDate, setSelectedStartDate] = useState('');
    const [selectedEndDate, setSelectedEndDate] = useState('');
    const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
    const [generatedSummary, setGeneratedSummary] = useState<string>('');
    const [generatedPlaylist, setGeneratedPlaylist] = useState<PlaylistItem[] | null>(null);
    

    const fetchSavedMeditations = async () => {
        try {
            const res = await api.get('/meditations');
            const apiMeditations: ApiMeditation[] = (res.data.meditations || []) as ApiMeditation[];
            const meditations: SavedMeditation[] = apiMeditations.map((meditation) => {
                const hasPlaylist = Array.isArray(meditation.playlist) && meditation.playlist.length > 0;
                const normalized: SavedMeditation = {
                    ...meditation,
                    audioExpiresAt: meditation.audio_expires_at ?? null,
                    audioRemovedAt: meditation.audio_removed_at ?? null,
                    isAudioAvailable: meditation.is_audio_available ?? hasPlaylist,
                    audioSecondsRemaining: meditation.audio_seconds_remaining ?? 0,
                };
                return normalized;
            });
            setSavedMeditations(meditations);
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

    const fetchCalendar = async () => {
        try {
            const calendarRes = await api.get('/stats/calendar');
            const data = calendarRes.data || {};
            setActivityDates({
                reflections: Array.isArray(data.reflections) ? data.reflections : Array.isArray(data.dates) ? data.dates : [],
                journals: Array.isArray(data.journals) ? data.journals : [],
            });
        } catch (err) {
            console.error("Error fetching calendar stats:", err);
        }
    };

    useEffect(() => {
        fetchSavedMeditations();
        fetchCalendar();
    }, []);

    const handlePlaySavedMeditation = async (meditationId: string) => {
        setIsLoadingMeditation(true);
        try {
            const res = await api.get(`/meditations/${meditationId}`);
            const playlist = res.data?.playlist;

            if (!playlist || playlist.length === 0) {
                alert('This meditation session is no longer available to play.');
                fetchSavedMeditations();
                return;
            }

            setMeditationPlaylist(playlist);
            setCurrentMeditationId(meditationId);
        } catch (err) {
            const error = err as AxiosError<{ error?: string }>;
            if (error?.response?.status === 410) {
                alert('This meditation session expired after 24 hours and is no longer playable.');
                fetchSavedMeditations();
            } else {
                console.error("Error loading meditation:", err);
                alert('Failed to load meditation. Please try again.');
            }
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
        setShowMeditationSubTypeModal(true);
    };

    const handleMeditationSubTypeSelection = (type: MeditationTypeSlug) => {
        setSelectedReflectionType(type);
        setShowMeditationSubTypeModal(false);
        setShowTimePeriodModal(true);
    };

    const handleTimePeriodSelection = (startDate: string, endDate: string) => {
        setSelectedStartDate(startDate);
        setSelectedEndDate(endDate);
        setShowTimePeriodModal(false);
        setShowExperienceModal(true);
    };
    const handleExperienceSelection = (noteIds: string[]) => {
        setSelectedNoteIds(noteIds);
        setShowExperienceModal(false);
        setShowReadyToBeginModal(true);
    };

    const handleReadyToBeginBack = () => {
        setShowReadyToBeginModal(false);
        setShowExperienceModal(true);
    };

    const handleReadyToBeginStart = async () => {
        setShowReadyToBeginModal(false);
        setIsGeneratingMeditation(true);
        setIsMeditationApiComplete(false);

        try {
            if (!isPremium && meditations && meditations.remaining <= 0) {
                setIsGeneratingMeditation(false);
                alert('You have used all free meditations on the Replay free plan. Upgrade to Replay Premium for unlimited sessions.');
                showPaywall();
                return;
            }
            console.log('🧘 Queuing background meditation job...');
            const jobResponse = await createJob({
                noteIds: selectedNoteIds,
                reflectionType: selectedReflectionType,
                startDate: selectedStartDate,
                endDate: selectedEndDate
            });

            console.log('✅ Background job queued:', jobResponse);

            // Reset session-specific state while keeping the generation modal visible
            setIsMeditationApiComplete(false);
            setGeneratedPlaylist(null);
            setMeditationPlaylist(null);
            setGeneratedSummary('');
            setSelectedReflectionType(DEFAULT_MEDITATION_TYPE);
            setSelectedStartDate('');
            setSelectedEndDate('');
            setSelectedNoteIds([]);
            await refreshSubscription({ force: true });
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
            setIsGeneratingMeditation(false);
            setIsMeditationApiComplete(false);
        }
    };

    const handleRunInBackground = () => {
        console.log('ℹ️ Meditation generation is already running in the background.');
        setIsGeneratingMeditation(false);
    };

    const handleMeditationReady = () => {
        console.log('🎯 handleMeditationReady called – generation continues in background.');
        setIsGeneratingMeditation(false);
        setIsMeditationApiComplete(false);
    };

    const handlePlayNow = () => {
        setShowGenerationModal(false);
        setMeditationPlaylist(generatedPlaylist);
    };

    const handleSaveLater = async () => {
        setShowGenerationModal(false);
        fetchSavedMeditations(); // Refresh the saved meditations list
        await refreshWeeklyProgress(); // Refresh stats since a new meditation was created
        // Reset state
        setSelectedReflectionType(DEFAULT_MEDITATION_TYPE);
        setSelectedStartDate('');
        setSelectedEndDate('');
        setSelectedNoteIds([]);
        setGeneratedSummary('');
        setGeneratedPlaylist(null);
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handleMeditationFinish = async (_completed: boolean) => {
        // Ignore completed parameter since we no longer show completion modal
        setMeditationPlaylist(null);
        setCurrentMeditationId(null);
        // Reset all state when meditation finishes
        setSelectedReflectionType(DEFAULT_MEDITATION_TYPE);
        setSelectedStartDate('');
        setSelectedEndDate('');
        setSelectedNoteIds([]);
        setGeneratedSummary('');
        fetchSavedMeditations(); // Refresh the saved meditations list
        await refreshWeeklyProgress(); // Refresh stats since meditation was completed
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

    const formatAvailabilityMessage = (meditation: SavedMeditation) => {
        if (!meditation.audioExpiresAt) {
            return 'Audio unavailable';
        }

        const expiry = new Date(meditation.audioExpiresAt);
        if (Number.isNaN(expiry.getTime())) {
            return meditation.isAudioAvailable ? 'Audio available for a limited time' : 'Audio expired after 24 hours';
        }

        if (!meditation.isAudioAvailable) {
            return 'Audio expired after 24 hours';
        }

        const now = new Date();
        const diffMs = expiry.getTime() - now.getTime();
        if (diffMs <= 0) {
            return 'Audio expired after 24 hours';
        }

        const diffMinutes = Math.ceil(diffMs / (1000 * 60));
        if (diffMinutes >= 60) {
            const diffHours = Math.ceil(diffMinutes / 60);
            if (diffHours >= 24) {
                return 'Audio available for 24 hours';
            }
            return `Audio available for ~${diffHours} hour${diffHours === 1 ? '' : 's'}`;
        }

        return `Audio available for ~${diffMinutes} minute${diffMinutes === 1 ? '' : 's'}`;
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
                            <p style={styles.desktopSubtitle}>Your meditation and reflection sessions</p>
                        </div>
                    </div>
                </div>
            )}

            <div style={isDesktop ? styles.desktopContentContainer : styles.contentContainer}>
                {/* Recent activity calendar - mobile only */}
                {!isDesktop && (
                    <>
                        <RecentActivityCalendar
                            journalDates={activityDates.journals}
                            reflectionDates={activityDates.reflections}
                            onExpandClick={() => setShowCalendarModal(true)}
                        />

                        <div style={styles.progressSection}>
                            <WeeklyProgressCard
                                summary={weeklyProgress}
                                journalGoal={journalGoal}
                                meditationGoal={meditationGoal}
                                reportJournalThreshold={progressThresholds?.reportJournals ?? 5}
                                isLoading={isProgressLoading}
                                error={progressError}
                                weekLabel={progressWeekStart ? `Week of ${progressWeekStart}` : 'This week'}
                                timezoneLabel={progressTimezone ?? null}
                                showReportStatus
                            />
                            {weeklyProgress?.reportReady && !weeklyProgress?.reportSent && (
                                <p style={styles.progressHint}>Weekly report will send Monday at midnight.</p>
                            )}
                        </div>
                    </>
                )}
            
            {/* Lotus Flower Button */}
            <div
                style={isDesktop ? styles.desktopCtaContainer : styles.ctaContainer}
            >
                <LotusFlowerButton onClick={handleStartReflection} />
            </div>

            {/* Recent Reflections Section */}
            <div style={styles.reflectionsSection}>
                <h2 style={styles.sectionTitle}>Your Reflections</h2>
                {savedMeditations.length > 0 ? (
                    <div style={styles.meditationsList}>
                    {savedMeditations
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                        .map(meditation => {
                        const isExpanded = expandedSummaries.has(meditation.id);
                        const isAudioAvailable = meditation.isAudioAvailable !== false;
                        const availabilityMessage = formatAvailabilityMessage(meditation);
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
                                        <span style={isAudioAvailable ? styles.availabilityBadgeActive : styles.availabilityBadgeExpired}>
                                            {isAudioAvailable ? 'Playable' : 'Expired'}
                                        </span>
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
                                        <div style={styles.availabilityNotice}>{availabilityMessage}</div>
                                        {meditation.duration && (
                                            <div style={styles.durationText}>
                                                Duration: {Math.max(1, Math.round((meditation.duration || 0) / 60))} minutes
                                            </div>
                                        )}
                                        <p style={styles.summaryText}>{meditation.summary}</p>
                                        <div style={styles.meditationActions}>
                                            {isAudioAvailable && (
                                                <button 
                                                    onClick={() => handlePlaySavedMeditation(meditation.id)}
                                                    style={styles.playButton}
                                                >
                                                    Play
                                                </button>
                                            )}
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
                            Click the "Generate Reflection" button above to create your personalized reflection session.
                        </p>
                    </div>
                )}
            </div>
            {/* Modals */}
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
            />
            
            <ReadyToBeginModal
                isOpen={showReadyToBeginModal}
                onClose={() => setShowReadyToBeginModal(false)}
                onBack={handleReadyToBeginBack}
                onStart={handleReadyToBeginStart}
                reflectionType={selectedReflectionType}
                period={formatDateRange()}
                experienceCount={selectedNoteIds.length}
                duration={DEFAULT_DURATION_MINUTES}
                extraContent={isPremium
                    ? <span>You’re on Replay Premium—enjoy unlimited meditation generations.</span>
                    : (
                        <div>
                            <p style={{ margin: 0 }}>
                                {typeof remainingMeditations === 'number'
                                    ? (remainingMeditations > 0
                                        ? `You have ${remainingMeditations} of ${meditationLimit ?? 2} free meditation${remainingMeditations === 1 ? '' : 's'} remaining.`
                                        : 'You have used all free meditations.')
                                    : 'Checking your free balance...'}
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
            
            
            <MeditationGenerationModal
                isOpen={showGenerationModal}
                onClose={() => setShowGenerationModal(false)}
                onPlayNow={handlePlayNow}
                onSaveLater={handleSaveLater}
                duration={DEFAULT_DURATION_MINUTES}
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
                journalDates={activityDates.journals}
                reflectionDates={activityDates.reflections}
            />
            </div>
        </div>
    );
};

const styles = {
    container: {
        paddingBottom: 'calc(100px + env(safe-area-inset-bottom, 0px))', // Space for bottom nav + safe area
        backgroundColor: '#f8f9ff',
        minHeight: '100vh',
        width: '100%',
        maxWidth: '100vw',
        margin: '0',
        position: 'relative',
        overflow: 'hidden',
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
        paddingTop: '1.5rem',
        paddingLeft: '1rem',
        paddingRight: '1rem',
        paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 16px))',
        backgroundColor: '#ffffff',
        borderTopLeftRadius: '20px',
        borderTopRightRadius: '20px',
        minHeight: 'calc(100vh - 120px)',
        width: '100%',
        maxWidth: '100%',
        margin: '-1rem 0 0 0',
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
    progressSection: {
        margin: '1.5rem 0',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '0.75rem',
    },
    progressHint: {
        margin: 0,
        fontSize: '0.85rem',
        color: '#475569',
    },
    progressLoading: {
        margin: 0,
        fontSize: '0.85rem',
        color: '#475569',
    },
    ctaContainer: {
        position: 'sticky' as const,
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)',
        zIndex: 5,
        padding: '1.5rem 0',
        marginTop: '1.5rem',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(to top, rgba(248,249,255,1) 60%, rgba(248,249,255,0.8) 80%, rgba(248,249,255,0))',
    },
    desktopCtaContainer: {
        margin: '2rem 0',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
    },
    inlineUpsellLink: {
        background: 'none',
        border: 'none',
        padding: 0,
        margin: '0.35rem 0 0',
        fontSize: '0.9rem',
        color: '#6366f1',
        textDecoration: 'underline',
        cursor: 'pointer',
        display: 'inline'
    },
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
    availabilityBadgeActive: {
        display: 'inline-block',
        marginTop: '6px',
        padding: '4px 8px',
        borderRadius: '999px',
        backgroundColor: '#dcfce7',
        color: '#15803d',
        fontSize: '12px',
        fontWeight: 500,
        width: 'fit-content' as const,
    },
    availabilityBadgeExpired: {
        display: 'inline-block',
        marginTop: '6px',
        padding: '4px 8px',
        borderRadius: '999px',
        backgroundColor: '#fee2e2',
        color: '#b91c1c',
        fontSize: '12px',
        fontWeight: 500,
        width: 'fit-content' as const,
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
    availabilityNotice: {
        fontSize: '13px',
        color: '#0f172a',
        margin: '0 0 8px 0',
        fontWeight: 500,
    },
    durationText: {
        fontSize: '13px',
        color: '#475569',
        margin: '0 0 12px 0',
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
