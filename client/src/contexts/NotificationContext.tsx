import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { MeditationJob } from './JobContext';

// Notification types and interfaces
export interface NotificationAction {
  label: string;
  variant: 'primary' | 'secondary';
  onClick: () => void;
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
  actions?: NotificationAction[];
  autoHide?: boolean;
  duration?: number;
  priority?: 'high' | 'normal' | 'low';
  timestamp: Date;
}

// Context value interface
interface NotificationContextValue {
  notifications: Notification[];
  showNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => string;
  dismissNotification: (id: string) => void;
  clearAllNotifications: () => void;
  pauseNotifications: () => void;
  resumeNotifications: () => void;
  isPaused: boolean;
}

// Create context
const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

// Provider component
export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [shownJobNotifications, setShownJobNotifications] = useState<Set<string>>(new Set());

  // Generate unique notification ID
  const generateId = useCallback(() => {
    return `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Show a new notification
  const showNotification = useCallback((notificationData: Omit<Notification, 'id' | 'timestamp'>) => {
    if (isPaused) {
      console.log('🔕 Notifications paused, queuing notification:', notificationData.title);
      return '';
    }

    const id = generateId();
    const notification: Notification = {
      ...notificationData,
      id,
      timestamp: new Date(),
      autoHide: notificationData.autoHide ?? (notificationData.type === 'success'),
      duration: notificationData.duration ?? (notificationData.type === 'success' ? 10000 : 0),
      priority: notificationData.priority ?? 'normal'
    };

    console.log('📢 Showing notification:', notification.title);

    setNotifications(prev => {
      // Add new notification to the top
      const updated = [notification, ...prev];
      
      // Keep only last 3 individual notifications to avoid UI clutter
      if (updated.length > 3) {
        // Remove oldest notifications
        return updated.slice(0, 3);
      }
      
      return updated;
    });

    // Set up auto-hide timer
    if (notification.autoHide && notification.duration && notification.duration > 0) {
      setTimeout(() => {
        dismissNotification(id);
      }, notification.duration);
    }

    return id;
  }, [isPaused, generateId]);

  // Dismiss a specific notification
  const dismissNotification = useCallback((id: string) => {
    console.log('✖️ Dismissing notification:', id);
    
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Clear all notifications
  const clearAllNotifications = useCallback(() => {
    console.log('🧹 Clearing all notifications');
    
    setNotifications([]);
    setShownJobNotifications(new Set());
  }, []);

  // Pause notifications (useful during modal interactions)
  const pauseNotifications = useCallback(() => {
    console.log('⏸️ Pausing notifications');
    setIsPaused(true);
  }, []);

  // Resume notifications
  const resumeNotifications = useCallback(() => {
    console.log('▶️ Resuming notifications');
    setIsPaused(false);
  }, []);

  // Helper function to show job-related notifications
  const showJobNotification = useCallback((job: MeditationJob, previousStatus?: string) => {
    // Prevent duplicate notifications for the same job status
    const notificationKey = `${job.jobId}-${job.status}`;
    if (shownJobNotifications.has(notificationKey)) {
      return;
    }

    // Mark this notification as shown
    setShownJobNotifications(prev => new Set([...prev, notificationKey]));

    if (job.status === 'completed' && previousStatus === 'processing') {
      // Success notification
      showNotification({
        type: 'success',
        title: `🎵 ${job.result?.title || 'Meditation'} Ready`,
        message: `Generated from ${job.experienceCount} experience${job.experienceCount !== 1 ? 's' : ''} • ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        actions: [
          {
            label: '▶ Play Now',
            variant: 'primary',
            onClick: () => {
              // Navigate to meditation player
              if (job.meditationId) {
                window.location.href = `/meditations/${job.meditationId}`;
              }
            }
          },
          {
            label: '💾 Save',
            variant: 'secondary',
            onClick: () => {
              // Meditation is already saved, just acknowledge
              console.log('Meditation saved successfully');
            }
          }
        ],
        autoHide: true,
        duration: 10000,
        priority: 'high'
      });

    } else if (job.status === 'failed') {
      // Error notification
      const errorMessage = job.error === 'TTS service unavailable' 
        ? 'Unable to connect to audio service'
        : job.error || 'Generation failed unexpectedly';

      showNotification({
        type: 'error',
        title: '⚠️ Meditation Generation Failed',
        message: errorMessage,
        actions: [
          {
            label: '🔄 Retry',
            variant: 'primary',
            onClick: () => {
              // This would be handled by the component using the notification
              console.log(`Retry requested for job ${job.jobId}`);
            }
          },
          {
            label: 'ℹ Details',
            variant: 'secondary',
            onClick: () => {
              // Show detailed error information
              console.log('Error details:', job.error);
            }
          }
        ],
        autoHide: false, // Error notifications require manual dismissal
        priority: 'high'
      });
    }
  }, [showNotification, shownJobNotifications]);

  // Helper to show welcome notifications for returning users
  const showWelcomeNotification = useCallback((completedJobs: MeditationJob[]) => {
    if (completedJobs.length === 0) return;

    const completedCount = completedJobs.length;
    const latestJob = completedJobs[0]; // Assuming sorted by completion time

    showNotification({
      type: 'info',
      title: `📋 ${completedCount} Meditation${completedCount !== 1 ? 's' : ''} Completed`,
      message: `Latest: ${latestJob.result?.title || 'Meditation'} • ${new Date(latestJob.completedAt!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      actions: [
        {
          label: '📝 View All',
          variant: 'primary',
          onClick: () => {
            // Navigate to meditations list
            window.location.href = '/meditations';
          }
        }
      ],
      autoHide: false, // Welcome notifications should be manually dismissed
      priority: 'normal'
    });
  }, [showNotification]);

  // Clean up old notification tracking on app refresh
  useEffect(() => {
    // Clear shown notifications on component mount (fresh session)
    const sessionKey = 'meditation-notifications-session';
    const currentSession = Date.now().toString();
    const lastSession = sessionStorage.getItem(sessionKey);
    
    if (lastSession !== currentSession) {
      // New session, clear notification tracking
      setShownJobNotifications(new Set());
      sessionStorage.setItem(sessionKey, currentSession);
    }
  }, []);

  const value: NotificationContextValue = {
    notifications,
    showNotification,
    dismissNotification,
    clearAllNotifications,
    pauseNotifications,
    resumeNotifications,
    isPaused
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

// Hook to use the notification context
export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

// Helper hook for job-specific notifications
export function useJobNotifications() {
  const { showNotification } = useNotifications();

  const showJobCompletion = useCallback((job: MeditationJob) => {
    showNotification({
      type: 'success',
      title: `🎵 ${job.result?.title || 'Meditation'} Ready`,
      message: `Generated from ${job.experienceCount} experience${job.experienceCount !== 1 ? 's' : ''}`,
      actions: [
        {
          label: '▶ Play Now',
          variant: 'primary',
          onClick: () => {
            if (job.meditationId) {
              window.location.href = `/meditations/${job.meditationId}`;
            }
          }
        }
      ],
      autoHide: true,
      duration: 10000,
      priority: 'high'
    });
  }, [showNotification]);

  const showJobError = useCallback((job: MeditationJob, onRetry?: () => void) => {
    showNotification({
      type: 'error',
      title: '⚠️ Meditation Generation Failed',
      message: job.error || 'An unexpected error occurred',
      actions: [
        {
          label: '🔄 Retry',
          variant: 'primary',
          onClick: () => {
            if (onRetry) onRetry();
          }
        }
      ],
      autoHide: false,
      priority: 'high'
    });
  }, [showNotification]);

  return {
    showJobCompletion,
    showJobError
  };
}

export default NotificationContext;