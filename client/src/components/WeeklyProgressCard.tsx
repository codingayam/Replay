import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Target, FileText, Brain, Flame, Info } from 'lucide-react';
import type { WeeklyProgressSummary } from '../hooks/useWeeklyProgress';

interface WeeklyProgressCardProps {
  summary: WeeklyProgressSummary | null;
  journalGoal: number;
  meditationGoal: number;
  isLoading?: boolean;
  isLocked?: boolean;
  error?: string | null;
  weekLabel?: string | null;
  timezoneLabel?: string | null;
  showReportStatus?: boolean;
  className?: string;
}

const WeeklyProgressCard: React.FC<WeeklyProgressCardProps> = ({
  summary,
  journalGoal,
  meditationGoal,
  isLoading = false,
  isLocked = false,
  error = null,
  weekLabel,
  timezoneLabel,
  showReportStatus = false,
  className
}) => {
  const journalCount = summary?.journalCount ?? 0;
  const meditationCount = summary?.meditationCount ?? 0;

  const journalGoalSafe = Math.max(journalGoal, 0);
  const meditationGoalSafe = Math.max(meditationGoal, 0);

  const metJournalGoal = journalGoalSafe === 0 ? true : journalCount >= journalGoalSafe;
  const metMeditationGoal = meditationGoalSafe === 0 ? true : meditationCount >= meditationGoalSafe;

  const goalsMet = [metJournalGoal, metMeditationGoal].filter(Boolean).length;
  const totalGoals = 2;

  const journalProgress = journalGoalSafe > 0 ? Math.min(journalCount / journalGoalSafe, 1) : 1;
  const meditationProgress = meditationGoalSafe > 0 ? Math.min(meditationCount / meditationGoalSafe, 1) : 1;

  const reportStatusLabel = summary?.reportReady
    ? 'Unlocked'
    : 'Locked';

  // Animation state
  const [animatingJournal, setAnimatingJournal] = useState(false);
  const [animatingMeditation, setAnimatingMeditation] = useState(false);

  // Track previous values
  const prevJournalCount = useRef<number | null>(null);
  const prevMeditationCount = useRef<number | null>(null);

  // Animated display values for count-up effect
  const [displayJournalCount, setDisplayJournalCount] = useState(journalCount);
  const [displayMeditationCount, setDisplayMeditationCount] = useState(meditationCount);

  // Tooltip state
  const [showTooltip, setShowTooltip] = useState(false);

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (showTooltip) {
        setShowTooltip(false);
      }
    };

    if (showTooltip) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showTooltip]);

  // Audio reference
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio('/sounds/rise.mp3');
    audioRef.current.volume = 0.5; // 50% volume
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const enableAudio = useCallback(() => {
    if (isAudioEnabled) {
      return;
    }

    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.muted = true;
    audio.currentTime = 0;
    audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
        setIsAudioEnabled(true);
      })
      .catch(err => {
        audio.muted = false;
        console.log('Audio unlock failed:', err);
      });
  }, [isAudioEnabled]);

  // Detect count increases and trigger animations
  useEffect(() => {
    // Skip on initial mount (when prev values are null)
    if (prevJournalCount.current === null || prevMeditationCount.current === null) {
      prevJournalCount.current = journalCount;
      prevMeditationCount.current = meditationCount;
      setDisplayJournalCount(journalCount);
      setDisplayMeditationCount(meditationCount);
      return;
    }

    // Check if journal count increased
    if (journalCount > prevJournalCount.current) {
      setAnimatingJournal(true);

      // Play sound
      if (audioRef.current && isAudioEnabled) {
        audioRef.current.currentTime = 0; // Reset to start
        audioRef.current.play().catch(err => console.log('Audio play failed:', err));
      }

      // Animate count-up
      animateCountUp(prevJournalCount.current, journalCount, setDisplayJournalCount);

      // Clear animation after duration
      setTimeout(() => setAnimatingJournal(false), 800);
    }

    // Check if meditation count increased
    if (meditationCount > prevMeditationCount.current) {
      setAnimatingMeditation(true);

      // Play sound
      if (audioRef.current && isAudioEnabled) {
        audioRef.current.currentTime = 0; // Reset to start
        audioRef.current.play().catch(err => console.log('Audio play failed:', err));
      }

      // Animate count-up
      animateCountUp(prevMeditationCount.current, meditationCount, setDisplayMeditationCount);

      // Clear animation after duration
      setTimeout(() => setAnimatingMeditation(false), 800);
    }

    // Update prev values
    prevJournalCount.current = journalCount;
    prevMeditationCount.current = meditationCount;
  }, [journalCount, meditationCount, isAudioEnabled]);

  // Helper function to animate number counting up
  const animateCountUp = (start: number, end: number, setter: (value: number) => void) => {
    const duration = 600; // ms
    const steps = Math.abs(end - start);
    const stepDuration = duration / steps;

    let current = start;
    const timer = setInterval(() => {
      current++;
      setter(current);
      if (current >= end) {
        clearInterval(timer);
      }
    }, stepDuration);
  };

  return (
    <>
      <style>{`
        @keyframes progress-pulse {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.7);
          }
          50% {
            transform: scale(1.05);
            box-shadow: 0 0 12px 4px rgba(251, 191, 36, 0.5);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(251, 191, 36, 0);
          }
        }

        @keyframes count-flourish {
          0% {
            transform: scale(1);
            color: inherit;
          }
          30% {
            transform: scale(1.3);
            color: #10b981;
            font-weight: 800;
          }
          60% {
            transform: scale(1.15);
            color: #059669;
          }
          100% {
            transform: scale(1);
            color: inherit;
          }
        }

        @keyframes sparkle-burst {
          0% {
            transform: translate(0, 0) scale(0) rotate(0deg);
            opacity: 1;
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: translate(var(--tx), var(--ty)) scale(1) rotate(180deg);
            opacity: 0;
          }
        }

        .progress-pulse {
          animation: progress-pulse 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .count-flourish {
          animation: count-flourish 0.8s cubic-bezier(0.4, 0, 0.2, 1);
          display: inline-block;
        }

        .sparkle-container {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          pointer-events: none;
          z-index: 10;
        }

        .sparkle {
          position: absolute;
          width: 8px;
          height: 8px;
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #fbbf24 100%);
          border-radius: 50%;
          animation: sparkle-burst 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
          box-shadow: 0 0 4px 1px rgba(251, 191, 36, 0.8);
        }

        .sparkle:nth-child(1) { --tx: -30px; --ty: -30px; animation-delay: 0ms; }
        .sparkle:nth-child(2) { --tx: 30px; --ty: -30px; animation-delay: 50ms; }
        .sparkle:nth-child(3) { --tx: -35px; --ty: 10px; animation-delay: 100ms; }
        .sparkle:nth-child(4) { --tx: 35px; --ty: 10px; animation-delay: 150ms; }
        .sparkle:nth-child(5) { --tx: 0px; --ty: -40px; animation-delay: 75ms; }

        @media (prefers-reduced-motion: reduce) {
          .progress-pulse,
          .count-flourish,
          .sparkle {
            animation: none;
          }
        }
      `}</style>
      <div style={styles.wrapper} className={className}>
        <div style={styles.card} onPointerDown={enableAudio}>
          <div style={styles.header}>
          <div style={styles.headerContent}>
            <h3 style={styles.title}>Weekly Goals</h3>
            <div style={styles.subtitle}>This week</div>
          </div>
          {isLocked && (
            <div style={styles.lockedBadge}>
              Locked
            </div>
          )}
        </div>

        {isLoading ? (
          <div style={styles.loadingState}>
            <div style={styles.shimmer} />
            <p style={styles.loadingText}>Loading stats...</p>
          </div>
        ) : (
          <>
            <div style={styles.progressOverview}>
              <div style={styles.progressStats}>
                <div style={styles.progressNumber}>{goalsMet}</div>
                <div style={styles.progressLabel}>of {totalGoals} completed</div>
              </div>
              <div style={{
                ...styles.progressRing,
                background: `conic-gradient(${isLocked ? '#dc2626' : goalsMet === totalGoals ? '#059669' : '#6366f1'} ${(goalsMet / totalGoals) * 360}deg, #f1f5f9 0deg)`
              }}>
                <div style={styles.progressRingInner}>
                  {goalsMet === totalGoals && !isLocked && (
                    <Flame size={16} style={{ color: '#059669' }} />
                  )}
                </div>
              </div>
            </div>

            <div style={styles.goalsContainer}>
              <div style={styles.goalRow}>
                <div style={styles.goalInfo}>
                  <FileText size={16} style={{ color: '#6366f1' }} />
                  <span style={styles.goalName}>Journal</span>
                </div>
                <div style={styles.goalProgress}>
                  <div style={{ ...styles.miniProgressBar, position: 'relative' }}>
                    <div
                      className={animatingJournal ? 'progress-pulse' : ''}
                      style={{
                        ...styles.miniProgressFill,
                        width: `${journalProgress * 100}%`,
                        background: metJournalGoal
                          ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
                          : 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%)'
                      }}
                    />
                    {animatingJournal && (
                      <div className="sparkle-container">
                        <div className="sparkle" />
                        <div className="sparkle" />
                        <div className="sparkle" />
                        <div className="sparkle" />
                        <div className="sparkle" />
                      </div>
                    )}
                  </div>
                  <span
                    className={animatingJournal ? 'count-flourish' : ''}
                    style={{
                      ...styles.goalCount,
                      color: metJournalGoal ? '#059669' : '#1e293b'
                    }}
                  >
                    {displayJournalCount}/{journalGoalSafe}
                  </span>
                </div>
              </div>

              <div style={styles.goalRow}>
                <div style={styles.goalInfo}>
                  <Brain size={16} style={{ color: '#8b5cf6' }} />
                  <span style={styles.goalName}>Meditation</span>
                </div>
                <div style={styles.goalProgress}>
                  <div style={{ ...styles.miniProgressBar, position: 'relative' }}>
                    <div
                      className={animatingMeditation ? 'progress-pulse' : ''}
                      style={{
                        ...styles.miniProgressFill,
                        width: `${meditationProgress * 100}%`,
                        background: metMeditationGoal
                          ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
                          : 'linear-gradient(90deg, #8b5cf6 0%, #a855f7 100%)'
                      }}
                    />
                    {animatingMeditation && (
                      <div className="sparkle-container">
                        <div className="sparkle" />
                        <div className="sparkle" />
                        <div className="sparkle" />
                        <div className="sparkle" />
                        <div className="sparkle" />
                      </div>
                    )}
                  </div>
                  <span
                    className={animatingMeditation ? 'count-flourish' : ''}
                    style={{
                      ...styles.goalCount,
                      color: metMeditationGoal ? '#059669' : '#1e293b'
                    }}
                  >
                    {displayMeditationCount}/{meditationGoalSafe}
                  </span>
                </div>
              </div>

              {showReportStatus && (
                <div style={{...styles.goalRow, overflow: 'visible', position: 'relative' as const}}>
                  <div style={styles.goalInfo}>
                    <FileText size={16} style={{ color: '#f59e0b' }} />
                    <span style={{...styles.goalName, overflow: 'visible', textOverflow: 'clip', whiteSpace: 'normal' as const}}>Weekly Report</span>
                    <div
                      style={styles.infoIconContainer}
                      className="info-icon-container"
                      onMouseEnter={() => setShowTooltip(true)}
                      onMouseLeave={() => setShowTooltip(false)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowTooltip(!showTooltip);
                      }}
                    >
                      <Info size={14} style={styles.infoIcon} />
                      <div style={{
                        ...styles.tooltip,
                        opacity: showTooltip ? 1 : 0,
                        visibility: showTooltip ? 'visible' : 'hidden'
                      } as React.CSSProperties}>
                        Your personalized weekly report will be unlocked after {journalGoalSafe} journals/notes and {meditationGoalSafe} meditations every week. It will be sent automatically to you at the end of the week to your login email.
                      </div>
                    </div>
                  </div>
                  <div style={styles.reportStatus}>
                    <span style={{
                      ...styles.statusChip,
                      backgroundColor: summary?.reportReady ? '#dcfce7' : '#fee2e2',
                      color: summary?.reportReady ? '#059669' : '#dc2626'
                    }}>
                      {reportStatusLabel}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {error && !isLoading && (
          <div style={styles.errorBox}>{error}</div>
        )}
      </div>
    </div>
    </>
  );
};

const styles = {
  wrapper: {
    width: '100%'
  } as React.CSSProperties,
  card: {
    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
    border: '1px solid rgba(226, 232, 240, 0.6)',
    borderRadius: '16px',
    padding: '1.5rem',
    boxShadow: '0 4px 12px 0 rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.1)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1.25rem',
    position: 'relative' as const,
    overflow: 'hidden'
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem'
  } as React.CSSProperties,
  headerContent: {
    flex: 1,
    minWidth: 0
  } as React.CSSProperties,
  title: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#1e293b',
    margin: 0,
    lineHeight: 1.3,
    letterSpacing: '-0.01em'
  } as React.CSSProperties,
  subtitle: {
    fontSize: '0.8rem',
    color: '#64748b',
    marginTop: '0.25rem',
    fontWeight: 500
  } as React.CSSProperties,
  lockedBadge: {
    marginLeft: 'auto',
    padding: '0.3rem 0.65rem',
    background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
    color: '#dc2626',
    borderRadius: '8px',
    fontSize: '0.7rem',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.025em',
    flexShrink: 0,
    alignSelf: 'center',
    border: '1px solid rgba(220, 38, 38, 0.2)',
    boxShadow: '0 1px 3px 0 rgba(220, 38, 38, 0.1)'
  } as React.CSSProperties,
  loadingState: {
    padding: '1rem 0',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '0.5rem'
  } as React.CSSProperties,
  shimmer: {
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    background: 'linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 50%, #f1f5f9 100%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s ease-in-out infinite'
  } as React.CSSProperties,
  loadingText: {
    fontSize: '0.8rem',
    color: '#94a3b8'
  } as React.CSSProperties,
  progressOverview: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1.25rem',
    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
    borderRadius: '12px',
    marginTop: '0.5rem',
    border: '1px solid rgba(226, 232, 240, 0.5)',
    position: 'relative' as const
  } as React.CSSProperties,
  progressStats: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.125rem'
  } as React.CSSProperties,
  progressNumber: {
    fontSize: '2rem',
    fontWeight: 800,
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    lineHeight: 1
  } as React.CSSProperties,
  progressLabel: {
    fontSize: '0.8rem',
    color: '#64748b',
    fontWeight: 600,
    letterSpacing: '0.01em'
  } as React.CSSProperties,
  progressRing: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    padding: '3px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative' as const,
    filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))'
  } as React.CSSProperties,
  progressRingInner: {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    backgroundColor: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid rgba(255, 255, 255, 0.9)',
    boxShadow: 'inset 0 1px 3px 0 rgba(0, 0, 0, 0.05)'
  } as React.CSSProperties,
  goalsContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1.25rem',
    marginTop: '0.75rem'
  } as React.CSSProperties,
  goalRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    padding: '0.875rem 1rem',
    background: 'rgba(255, 255, 255, 0.7)',
    borderRadius: '12px',
    border: '1px solid rgba(226, 232, 240, 0.4)',
    transition: 'all 0.2s ease',
    backdropFilter: 'blur(10px)',
    minHeight: '50px',
    overflow: 'hidden'
  } as React.CSSProperties,
  goalInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    minWidth: 0,
    flex: '1 1 auto',
    overflow: 'hidden'
  } as React.CSSProperties,
  goalName: {
    fontSize: '0.9rem',
    color: '#475569',
    fontWeight: 600,
    letterSpacing: '-0.01em',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  } as React.CSSProperties,
  goalProgress: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    flex: '0 0 auto'
  } as React.CSSProperties,
  goalCount: {
    fontSize: '0.85rem',
    fontWeight: 700,
    minWidth: '2.25rem',
    textAlign: 'center' as const,
    letterSpacing: '-0.01em',
    flexShrink: 0,
    whiteSpace: 'nowrap' as const
  } as React.CSSProperties,
  miniProgressBar: {
    width: '55px',
    height: '5px',
    backgroundColor: '#f1f5f9',
    borderRadius: '999px',
    overflow: 'hidden',
    border: '1px solid rgba(226, 232, 240, 0.6)',
    boxShadow: 'inset 0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    flexShrink: 0,
    position: 'relative' as const
  } as React.CSSProperties,
  miniProgressFill: {
    height: '100%',
    borderRadius: '999px',
    transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
    position: 'relative' as const,
    overflow: 'hidden'
  } as React.CSSProperties,
  reportStatus: {
    display: 'flex',
    alignItems: 'center'
  } as React.CSSProperties,
  statusChip: {
    padding: '0.3rem 0.75rem',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.025em',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
    backdropFilter: 'blur(4px)'
  } as React.CSSProperties,
  errorBox: {
    marginTop: '0.75rem',
    padding: '0.75rem 1rem',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
    border: '1px solid rgba(220, 38, 38, 0.2)',
    color: '#dc2626',
    fontSize: '0.8rem',
    fontWeight: 600,
    boxShadow: '0 2px 4px 0 rgba(220, 38, 38, 0.1)'
  } as React.CSSProperties,
  infoIconContainer: {
    position: 'relative' as const,
    display: 'inline-flex',
    alignItems: 'center',
    marginLeft: '0.25rem',
    cursor: 'help'
  } as React.CSSProperties,
  infoIcon: {
    color: '#9ca3af',
    flexShrink: 0
  } as React.CSSProperties,
  tooltip: {
    position: 'absolute' as const,
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginBottom: '0.5rem',
    padding: '0.75rem',
    backgroundColor: '#1f2937',
    color: '#ffffff',
    fontSize: '0.75rem',
    lineHeight: 1.4,
    borderRadius: '8px',
    whiteSpace: 'normal' as const,
    width: '280px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    opacity: 0,
    visibility: 'hidden' as const,
    transition: 'opacity 0.2s, visibility 0.2s',
    zIndex: 1000,
    pointerEvents: 'none' as const
  } as React.CSSProperties
};

export default WeeklyProgressCard;
