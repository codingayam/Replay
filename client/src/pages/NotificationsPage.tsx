import React, { useState, useEffect, useRef } from 'react';
import { Bell, Clock, Calendar, Smartphone, TestTube, AlertCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../hooks/useNotifications';
import { useAuthenticatedApi } from '../utils/api';

interface NotificationPreferences {
  enabled: boolean;
  daily_reminder: {
    enabled: boolean;
    time: string;
  };
  streak_reminder: {
    enabled: boolean;
    time: string;
  };
  meditation_ready: {
    enabled: boolean;
  };
  weekly_reflection: {
    enabled: boolean;
    day: string;
    time: string;
  };
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: true,
  daily_reminder: {
    enabled: true,
    time: '01:00'
  },
  streak_reminder: {
    enabled: true,
    time: '09:00'
  },
  meditation_ready: {
    enabled: true
  },
  weekly_reflection: {
    enabled: true,
    day: 'sunday',
    time: '10:00'
  }
};

const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const notifications = useNotifications();
  const api = useAuthenticatedApi();

  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [testingType, setTestingType] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const saveResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadPreferences = async () => {
      setIsFetching(true);
      setError(null);

      try {
        const response = await api.get('/notifications/preferences');
        if (!isMounted) return;

        const remote = response.data?.preferences as NotificationPreferences | undefined;
        setPreferences(remote ?? DEFAULT_PREFERENCES);
        setHasChanges(false);
      } catch (err) {
        console.error('Failed to load notification preferences:', err);
        if (!isMounted) return;
        setError('Failed to load notification preferences');
        setPreferences(DEFAULT_PREFERENCES);
        setHasChanges(false);
      } finally {
        if (isMounted) {
          setIsFetching(false);
        }
      }
    };

    loadPreferences();

    return () => {
      isMounted = false;
      if (saveResetRef.current) {
        clearTimeout(saveResetRef.current);
      }
    };
  }, [api]);

  const handleChange = (path: string[], value: any) => {
    if (!preferences) return;

    const updated = { ...preferences };
    let current: any = updated;

    for (let i = 0; i < path.length - 1; i++) {
      current[path[i]] = { ...current[path[i]] };
      current = current[path[i]];
    }

    current[path[path.length - 1]] = value;

    setPreferences(updated);
    setHasChanges(true);
    setJustSaved(false);
  };

  const handleSave = async () => {
    if (!preferences || !hasChanges) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await api.put('/notifications/preferences', {
        preferences
      });

      if (response.data?.preferences) {
        setPreferences(response.data.preferences);
      }
      setHasChanges(false);
      setJustSaved(true);
      if (saveResetRef.current) {
        clearTimeout(saveResetRef.current);
      }
      saveResetRef.current = setTimeout(() => {
        setJustSaved(false);
      }, 2000);
    } catch (err: unknown) {
      console.error('Failed to save notification settings:', err);
      const message =
        (err as any)?.response?.data?.error ||
        (err as any)?.message ||
        'Failed to save notification settings';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTest = async (type: string) => {
    setTestingType(type);
    try {
      // API call to send test notification would go here
      console.log('Testing notification type:', type);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
    } finally {
      setTestingType(null);
    }
  };

  if (isFetching && !preferences) {
    return <div style={styles.loading}>Loading preferences...</div>;
  }

  if (!preferences) {
    return <div style={styles.loading}>Unable to load preferences.</div>;
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button onClick={() => navigate('/profile')} style={styles.backButton}>
          <ArrowLeft size={20} />
        </button>
        <h1 style={styles.title}>Profile</h1>
      </div>
      <p style={styles.subtitle}>Manage your account</p>

      {/* Notification Settings Card */}
      <div style={styles.card}>
        {/* Main Settings Header */}
        <div style={styles.settingsHeader}>
          <div style={styles.settingsIcon}>
            <Bell size={24} style={{ color: '#6366f1' }} />
          </div>
          <div style={styles.settingsInfo}>
            <h2 style={styles.settingsTitle}>Notification Settings</h2>
            <p style={styles.settingsSubtitle}>Manage when and how you receive notifications</p>
          </div>
          <div style={styles.globalToggle}>
            <span style={styles.toggleLabel}>
              {preferences.enabled ? 'Enabled' : 'Disabled'}
            </span>
            <label style={styles.toggleSwitch}>
              <input
                type="checkbox"
                checked={preferences.enabled}
                onChange={(e) => handleChange(['enabled'], e.target.checked)}
                style={styles.toggleInput}
              />
              <span style={{
                ...styles.toggleSlider,
                ...(preferences.enabled ? styles.toggleSliderActive : {})
              }}>
                <span style={{
                  ...styles.toggleKnob,
                  ...(preferences.enabled ? styles.toggleKnobActive : {})
                }} />
              </span>
            </label>
          </div>
        </div>

        {error && (
          <div style={styles.errorAlert}>
            <AlertCircle size={16} style={{ color: '#dc2626' }} />
            <p style={styles.errorText}>{error}</p>
          </div>
        )}

        {/* Notification Types */}
        <div style={{
          ...styles.notificationsList,
          ...(preferences.enabled ? {} : styles.disabledSection)
        }}>
          {/* Meditation Ready */}
          <div style={styles.notificationItem}>
            <div style={styles.notificationIcon}>
              <span style={styles.notificationEmoji}>🧘</span>
            </div>
            <div style={styles.notificationInfo}>
              <h3 style={styles.notificationTitle}>Meditation Ready</h3>
              <p style={styles.notificationDesc}>Get notified when your meditation generation is complete</p>
              <span style={styles.notificationTiming}>Immediate</span>
            </div>
            <label style={styles.toggleSwitch}>
              <input
                type="checkbox"
                checked={preferences.meditation_ready.enabled}
                onChange={(e) => handleChange(['meditation_ready', 'enabled'], e.target.checked)}
                style={styles.toggleInput}
              />
              <span style={{
                ...styles.toggleSlider,
                ...(preferences.meditation_ready.enabled ? styles.toggleSliderActive : {})
              }}>
                <span style={{
                  ...styles.toggleKnob,
                  ...(preferences.meditation_ready.enabled ? styles.toggleKnobActive : {})
                }} />
              </span>
            </label>
          </div>

          {/* Daily Reminder */}
          <div style={styles.notificationItem}>
            <div style={styles.notificationIcon}>
              <Clock size={20} style={{ color: '#6366f1' }} />
            </div>
            <div style={styles.notificationInfo}>
              <h3 style={styles.notificationTitle}>Daily Reflection Reminder</h3>
              <p style={styles.notificationDesc}>Remind me to capture today's moments</p>
              <div style={styles.timeSettings}>
                <Clock size={16} style={{ color: '#6b7280' }} />
                <input
                  type="time"
                  value={preferences.daily_reminder.time}
                  onChange={(e) => handleChange(['daily_reminder', 'time'], e.target.value)}
                  disabled={!preferences.daily_reminder.enabled}
                  style={styles.timeInput}
                />
                <span style={styles.frequency}>Daily</span>
              </div>
            </div>
            <label style={styles.toggleSwitch}>
              <input
                type="checkbox"
                checked={preferences.daily_reminder.enabled}
                onChange={(e) => handleChange(['daily_reminder', 'enabled'], e.target.checked)}
                style={styles.toggleInput}
              />
              <span style={{
                ...styles.toggleSlider,
                ...(preferences.daily_reminder.enabled ? styles.toggleSliderActive : {})
              }}>
                <span style={{
                  ...styles.toggleKnob,
                  ...(preferences.daily_reminder.enabled ? styles.toggleKnobActive : {})
                }} />
              </span>
            </label>
          </div>

          {/* Streak Reminder */}
          <div style={styles.notificationItem}>
            <div style={styles.notificationIcon}>
              <span style={styles.notificationEmoji}>🔥</span>
            </div>
            <div style={styles.notificationInfo}>
              <h3 style={styles.notificationTitle}>Meditation Streak Reminder</h3>
              <p style={styles.notificationDesc}>Remind me to maintain my meditation streak</p>
              <div style={styles.timeSettings}>
                <Clock size={16} style={{ color: '#6b7280' }} />
                <input
                  type="time"
                  value={preferences.streak_reminder.time}
                  onChange={(e) => handleChange(['streak_reminder', 'time'], e.target.value)}
                  disabled={!preferences.streak_reminder.enabled}
                  style={styles.timeInput}
                />
                <span style={styles.frequency}>Daily</span>
              </div>
            </div>
            <label style={styles.toggleSwitch}>
              <input
                type="checkbox"
                checked={preferences.streak_reminder.enabled}
                onChange={(e) => handleChange(['streak_reminder', 'enabled'], e.target.checked)}
                style={styles.toggleInput}
              />
              <span style={{
                ...styles.toggleSlider,
                ...(preferences.streak_reminder.enabled ? styles.toggleSliderActive : {})
              }}>
                <span style={{
                  ...styles.toggleKnob,
                  ...(preferences.streak_reminder.enabled ? styles.toggleKnobActive : {})
                }} />
              </span>
            </label>
          </div>

          {/* Weekly Reflection */}
          <div style={styles.notificationItem}>
            <div style={styles.notificationIcon}>
              <span style={styles.notificationEmoji}>🌸</span>
            </div>
            <div style={styles.notificationInfo}>
              <h3 style={styles.notificationTitle}>Weekly Reflection Suggestion</h3>
              <p style={styles.notificationDesc}>Suggest creating a weekly reflection</p>
              <div style={styles.weeklySettings}>
                <span style={styles.dayBadge}>Sundays</span>
              </div>
            </div>
            <label style={styles.toggleSwitch}>
              <input
                type="checkbox"
                checked={preferences.weekly_reflection.enabled}
                onChange={(e) => handleChange(['weekly_reflection', 'enabled'], e.target.checked)}
                style={styles.toggleInput}
              />
              <span style={{
                ...styles.toggleSlider,
                ...(preferences.weekly_reflection.enabled ? styles.toggleSliderActive : {})
              }}>
                <span style={{
                  ...styles.toggleKnob,
                  ...(preferences.weekly_reflection.enabled ? styles.toggleKnobActive : {})
                }} />
              </span>
            </label>
          </div>
        </div>

        {/* Save Button */}
        {(hasChanges || isLoading || justSaved) && (
          <div style={styles.saveSection}>
            <button
              onClick={handleSave}
              disabled={isLoading || !hasChanges}
              style={{
                ...styles.saveButton,
                ...((isLoading || !hasChanges) ? styles.saveButtonDisabled : {})
              }}
            >
              {isLoading
                ? 'Saving Notification Settings'
                : !hasChanges && justSaved
                  ? 'Notification Settings Saved'
                  : 'Save Notification Settings'}
            </button>
            {justSaved && !hasChanges && (
              <p style={styles.saveMessage}>Your preferences are now synced.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '0',
    maxWidth: '800px',
    margin: '0 auto',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '200px',
    fontSize: '1rem',
    color: '#6b7280',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    marginBottom: '0.5rem',
  },
  backButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0.5rem',
    borderRadius: '50%',
    color: '#6b7280',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: '600',
    color: '#1f2937',
    margin: 0,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: '#6b7280',
    margin: '0 0 2rem 0',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '2rem',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    border: '1px solid #f3f4f6',
  },
  settingsHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    marginBottom: '2rem',
    paddingBottom: '1.5rem',
    borderBottom: '1px solid #f3f4f6',
  },
  settingsIcon: {
    width: '48px',
    height: '48px',
    backgroundColor: '#ede9fe',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  settingsInfo: {
    flex: 1,
  },
  settingsTitle: {
    fontSize: '1.25rem',
    fontWeight: '600',
    color: '#1f2937',
    margin: '0 0 0.25rem 0',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  settingsSubtitle: {
    fontSize: '0.875rem',
    color: '#6b7280',
    margin: 0,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  globalToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  toggleLabel: {
    fontSize: '0.875rem',
    fontWeight: '500',
    color: '#1f2937',
  },
  errorAlert: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    marginBottom: '1.5rem',
  },
  errorText: {
    fontSize: '0.875rem',
    color: '#dc2626',
    margin: 0,
  },
  notificationsList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1.5rem',
  },
  disabledSection: {
    opacity: 0.5,
    pointerEvents: 'none' as const,
  },
  notificationItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '1rem',
    padding: '1.5rem',
    backgroundColor: '#f9fafb',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
  },
  notificationIcon: {
    width: '40px',
    height: '40px',
    backgroundColor: '#ede9fe',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  notificationEmoji: {
    fontSize: '1.25rem',
  },
  notificationInfo: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#1f2937',
    margin: '0 0 0.25rem 0',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  notificationDesc: {
    fontSize: '0.875rem',
    color: '#6b7280',
    margin: '0 0 0.75rem 0',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  notificationTiming: {
    display: 'inline-block',
    padding: '0.25rem 0.5rem',
    backgroundColor: '#dbeafe',
    color: '#1d4ed8',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: '500',
  },
  timeSettings: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  timeInput: {
    padding: '0.25rem 0.5rem',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '0.875rem',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  frequency: {
    padding: '0.25rem 0.5rem',
    backgroundColor: '#f3f4f6',
    color: '#374151',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: '500',
  },
  weeklySettings: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  dayBadge: {
    padding: '0.25rem 0.5rem',
    backgroundColor: '#f3f4f6',
    color: '#374151',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: '500',
  },
  toggleSwitch: {
    position: 'relative' as const,
    display: 'inline-block',
    width: '44px',
    height: '24px',
    cursor: 'pointer',
  },
  toggleInput: {
    opacity: 0,
    width: 0,
    height: 0,
  },
  toggleSlider: {
    position: 'absolute' as const,
    cursor: 'pointer',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#d1d5db',
    borderRadius: '24px',
    transition: 'background-color 0.3s',
  },
  toggleSliderActive: {
    backgroundColor: '#6366f1',
  },
  toggleKnob: {
    position: 'absolute' as const,
    content: '""',
    height: '20px',
    width: '20px',
    left: '2px',
    bottom: '2px',
    backgroundColor: 'white',
    borderRadius: '50%',
    transition: 'transform 0.3s',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  toggleKnobActive: {
    transform: 'translateX(20px)',
  },
  saveSection: {
    marginTop: '2rem',
    paddingTop: '1.5rem',
    borderTop: '1px solid #f3f4f6',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-end',
    gap: '0.5rem',
  },
  saveButton: {
    padding: '0.75rem 2rem',
    backgroundColor: '#6366f1',
    color: 'white',
    border: 'none',
    borderRadius: '50px',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  saveButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
    backgroundColor: '#4f46e5',
  },
  saveMessage: {
    fontSize: '0.85rem',
    color: '#10b981',
    margin: 0,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
};

export default NotificationsPage;
