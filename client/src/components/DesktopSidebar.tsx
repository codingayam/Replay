import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Calendar, Brain, User } from 'lucide-react';
import RecentActivityCalendar from './RecentActivityCalendar';
import CalendarModal from './CalendarModal';
import WeeklyProgressCard from './WeeklyProgressCard';
import { useAuthenticatedApi } from '../utils/api';
import useWeeklyProgress from '../hooks/useWeeklyProgress';

const DesktopSidebar: React.FC = () => {
  const location = useLocation();
  const api = useAuthenticatedApi();
  const {
    summary: weeklyProgress,
    thresholds: progressThresholds,
    isLoading: isProgressLoading,
    error: progressError,
    weekStart,
    timezone
  } = useWeeklyProgress();
  const journalGoal = progressThresholds?.unlockMeditations ?? 3;
  const meditationGoal = progressThresholds?.reportMeditations ?? 2;
  const meditationsUnlocked = weeklyProgress?.meditationsUnlocked ?? false;

  const [reflectionDates, setReflectionDates] = useState<string[]>([]);
  const [showCalendarModal, setShowCalendarModal] = useState(false);

  const navigation = [
    { path: '/experiences', icon: Calendar, label: 'Experiences' },
    { path: '/reflections', icon: Brain, label: 'Reflections' },
    { path: '/profile', icon: User, label: 'Profile' },
  ];

  // Fetch calendar data for recent activity
  useEffect(() => {
    const fetchCalendar = async () => {
      try {
        const calendarRes = await api.get('/stats/calendar');
        setReflectionDates(calendarRes.data.dates || []);
      } catch (error) {
        console.error('Error fetching calendar stats:', error);
      }
    };

    fetchCalendar();
  }, [api]);

  const handleCalendarExpand = () => {
    setShowCalendarModal(true);
  };

  return (
    <div style={styles.sidebar}>
      {/* Logo and tagline */}
      <div style={styles.logoSection}>
        <div style={styles.logoContainer}>
          <div style={styles.logo}>📱</div>
          <h1 style={styles.appName}>Replay</h1>
        </div>
        <p style={styles.tagline}>Your mindful journey</p>
      </div>


      {/* Navigation */}
      <nav style={styles.navigation}>
        {navigation.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path === '/experiences' && location.pathname === '/');
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              to={item.path}
              style={{
                ...styles.navItem,
                ...(isActive ? styles.navItemActive : {})
              }}
            >
              <Icon size={20} style={styles.navIcon} />
              <span style={styles.navLabel}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div style={styles.progressWrapper}>
        <WeeklyProgressCard
          summary={weeklyProgress}
          journalGoal={journalGoal}
          meditationGoal={meditationGoal}
          isLoading={isProgressLoading}
          isLocked={!meditationsUnlocked}
          error={progressError}
          weekLabel={weekStart ? `Week of ${weekStart}` : null}
          timezoneLabel={timezone ?? null}
          showReportStatus
        />
      </div>

      {/* Recent Activity Calendar */}
      <RecentActivityCalendar
        reflectionDates={reflectionDates}
        onExpandClick={handleCalendarExpand}
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
  sidebar: {
    width: '320px',
    height: '100vh',
    backgroundColor: '#ffffff',
    borderRight: '1px solid #e5e7eb',
    padding: '2rem 1.5rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2rem',
    overflowY: 'auto' as const,
    position: 'fixed' as const,
    left: 0,
    top: 0,
    zIndex: 100,
  },
  logoSection: {
    textAlign: 'center' as const,
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
    marginBottom: '0.5rem',
  },
  logo: {
    fontSize: '2rem',
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    borderRadius: '12px',
    width: '48px',
    height: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontSize: '1.75rem',
    fontWeight: '700',
    color: '#6366f1',
    margin: 0,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  tagline: {
    fontSize: '0.875rem',
    color: '#6b7280',
    margin: 0,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  navigation: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.25rem',
    marginBottom: '0.5rem',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.625rem 1rem',
    borderRadius: '8px',
    textDecoration: 'none',
    color: '#6b7280',
    transition: 'all 0.2s ease',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  navItemActive: {
    backgroundColor: '#f3f4f6',
    color: '#6366f1',
  },
  navIcon: {
    flexShrink: 0,
  },
  navLabel: {
    fontSize: '0.9rem',
    fontWeight: '500',
  },
  progressWrapper: {
    margin: '0.5rem 0',
  },
};

export default DesktopSidebar;
