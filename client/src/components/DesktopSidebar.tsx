import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Calendar, Brain, User, Flame, Target } from 'lucide-react';
import RecentActivityCalendar from './RecentActivityCalendar';
import CalendarModal from './CalendarModal';
import { useAuthenticatedApi } from '../utils/api';

const DesktopSidebar: React.FC = () => {
  const location = useLocation();
  const api = useAuthenticatedApi();

  // Stats state
  const [dayStreak, setDayStreak] = useState(0);
  const [monthlyCount, setMonthlyCount] = useState(0);
  const [reflectionDates, setReflectionDates] = useState<string[]>([]);
  const [showCalendarModal, setShowCalendarModal] = useState(false);

  const navigation = [
    { path: '/experiences', icon: Calendar, label: 'Experiences' },
    { path: '/reflections', icon: Brain, label: 'Reflections' },
    { path: '/profile', icon: User, label: 'Profile' },
  ];

  // Fetch stats data
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [streakRes, monthlyRes, calendarRes] = await Promise.all([
          api.get('/stats/streak'),
          api.get('/stats/monthly'),
          api.get('/stats/calendar')
        ]);

        setDayStreak(streakRes.data.streak);
        setMonthlyCount(monthlyRes.data.count);
        setReflectionDates(calendarRes.data.dates || []);
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };

    fetchStats();
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

      {/* Stats Cards */}
      <div style={styles.statsSection}>
        {/* Day Streak Card */}
        <div style={{...styles.statCard, ...styles.streakCard}}>
          <div style={styles.statCardContent}>
            <div style={styles.statNumber}>{dayStreak}</div>
            <div style={styles.statLabel}>Day Streak</div>
          </div>
          <div style={styles.statIcon}>
            <Flame size={24} style={{ color: '#fff' }} />
          </div>
        </div>

        {/* Monthly Count Card */}
        <div style={{...styles.statCard, ...styles.monthlyCard}}>
          <div style={styles.statCardContent}>
            <div style={styles.statNumber}>{monthlyCount}</div>
            <div style={styles.statLabel}>This Month</div>
          </div>
          <div style={styles.statIcon}>
            <Target size={24} style={{ color: '#fff' }} />
          </div>
        </div>
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
    width: '280px',
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
    gap: '0.5rem',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1rem',
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
  statsSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
  },
  statCard: {
    borderRadius: '12px',
    padding: '1.25rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    color: 'white',
    position: 'relative' as const,
    overflow: 'hidden',
  },
  streakCard: {
    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
  },
  monthlyCard: {
    background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
  },
  statCardContent: {
    zIndex: 2,
  },
  statNumber: {
    fontSize: '2rem',
    fontWeight: '700',
    lineHeight: 1,
    marginBottom: '0.25rem',
  },
  statLabel: {
    fontSize: '0.875rem',
    fontWeight: '500',
    opacity: 0.9,
  },
  statIcon: {
    opacity: 0.3,
    zIndex: 1,
  },
};

export default DesktopSidebar;
