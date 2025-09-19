import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAuthenticatedApi } from '../utils/api';
import {
  isPushSupported,
  isSafariWebPush,
  getPermissionStatus,
  requestNotificationPermission,
  getFCMToken,
  getAppleWebPushToken,
  registerServiceWorker,
  listenForServiceWorkerMessages,
  setupForegroundMessageListener,
  getBrowserInfo,
  handleNotificationClick,
  shouldShowPermissionBanner,
  dismissPermissionBanner,
  markPermissionBannerShown,
  checkNotificationSupport,
  requestServiceWorkerVersion
} from '../utils/notificationUtils';

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

interface UseNotificationsReturn {
  isSupported: boolean;
  supportReason?: string;
  permission: NotificationPermission;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  preferences: NotificationPreferences | null;
  showPermissionBanner: boolean;
  requestPermission: () => Promise<boolean>;
  dismissBanner: () => void;
  initializeNotifications: () => Promise<void>;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>;
  testNotification: (type: string) => Promise<void>;
  serviceWorkerVersion: string | null;
  hasServiceWorkerUpdate: boolean;
  applyPendingServiceWorker: () => Promise<void>;
}

export const useNotifications = (): UseNotificationsReturn => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const api = useAuthenticatedApi();

  const [isSupported, setIsSupported] = useState(false);
  const [supportReason, setSupportReason] = useState<string>();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [showPermissionBanner, setShowPermissionBanner] = useState(false);
  const foregroundListenerRef = useRef<(() => void) | null>(null);
  const serviceWorkerListenerRef = useRef<(() => void) | null>(null);
  const [swVersion, setSwVersion] = useState<string | null>(null);
  const [hasSwUpdate, setHasSwUpdate] = useState(false);
  const bannerShownRef = useRef(false);

  // Check browser support
  useEffect(() => {
    const support = checkNotificationSupport();
    setIsSupported(support.supported);
    setSupportReason(support.reason);
    setPermission(getPermissionStatus());
    const shouldShow = shouldShowPermissionBanner();
    setShowPermissionBanner(shouldShow);

    if (shouldShow) {
      markPermissionBannerShown();
    }
  }, []);

  const trackEvent = useCallback(async (eventName: string, payload: Record<string, unknown> = {}) => {
    if (!user) return;

    try {
      await api.post('/notifications/events', {
        eventName,
        payload
      });
    } catch (error) {
      console.error('Failed to track notification event:', error);
    }
  }, [api, user]);

  useEffect(() => {
    const handleSwUpdateAvailable = () => {
      setHasSwUpdate(true);
      trackEvent('service_worker_update_available', {
        version: swVersion
      });
    };

    window.addEventListener('replay-sw-update-available', handleSwUpdateAvailable);

    return () => window.removeEventListener('replay-sw-update-available', handleSwUpdateAvailable);
  }, [trackEvent, swVersion]);

  useEffect(() => () => {
    if (foregroundListenerRef.current) {
      foregroundListenerRef.current();
      foregroundListenerRef.current = null;
    }
  }, []);

  // Keep banner visibility in sync with permission changes/local markers
  useEffect(() => {
    const shouldShow = shouldShowPermissionBanner();
    setShowPermissionBanner(shouldShow);
    if (shouldShow) {
      markPermissionBannerShown();
    }
  }, [permission, isSupported]);

  useEffect(() => {
    if (showPermissionBanner && !bannerShownRef.current) {
      bannerShownRef.current = true;
      trackEvent('notification_permission_banner_shown', {
        supportReason
      });
    }
  }, [showPermissionBanner, supportReason, trackEvent]);

  useEffect(() => {
    const handleMeditationGenerated = () => {
      const shouldShow = shouldShowPermissionBanner();
      setShowPermissionBanner(shouldShow);
      if (shouldShow) {
        markPermissionBannerShown();
      }
    };

    window.addEventListener('replay-meditation-generated', handleMeditationGenerated);
    window.addEventListener('storage', handleMeditationGenerated);

    return () => {
      window.removeEventListener('replay-meditation-generated', handleMeditationGenerated);
      window.removeEventListener('storage', handleMeditationGenerated);
    };
  }, []);

  // Register service worker and setup listeners
  useEffect(() => {
    if (!isSupported || !user) return;

    let cancelled = false;
    const handleNavigation = (event: CustomEvent) => {
      if (event.detail?.path) {
        navigate(event.detail.path);
      }
    };

    (async () => {
      try {
        await registerServiceWorker();
        if (cancelled) return;

        const version = await requestServiceWorkerVersion();
        setSwVersion(version);

        if (serviceWorkerListenerRef.current) {
          serviceWorkerListenerRef.current();
        }
        serviceWorkerListenerRef.current = listenForServiceWorkerMessages((data) => {
          if (data.type === 'NOTIFICATION_CLICK' && data.url) {
            trackEvent('notification_opened', {
              url: data.url,
              channel: data.channel,
              notificationId: data.notificationId
            });
            handleNotificationClick(data.url);
          }

          if (data.type === 'SW_VERSION_UPDATE') {
            setSwVersion(data.version);
            setHasSwUpdate(false);
            trackEvent('service_worker_version_reported', {
              version: data.version
            });
          }
        });

        window.addEventListener('notification-navigation', handleNavigation as EventListener);
      } catch (err) {
        console.error('Failed to setup service worker:', err);
        setError('Failed to initialize notifications');
      }
    })();

    return () => {
      cancelled = true;
      window.removeEventListener('notification-navigation', handleNavigation as EventListener);
      if (serviceWorkerListenerRef.current) {
        serviceWorkerListenerRef.current();
        serviceWorkerListenerRef.current = null;
      }
    };
  }, [isSupported, user, navigate]);

  // Load user preferences
  useEffect(() => {
    if (!user) return;

    const loadPreferences = async () => {
      try {
        const response = await api.get('/notifications/preferences');
        setPreferences(response.data.preferences);
      } catch (err) {
        console.error('Failed to load notification preferences:', err);
      }
    };

    loadPreferences();
  }, [user, api]);

  // Initialize notifications
  const initializeNotifications = useCallback(async () => {
    if (!isSupported || !user || isInitialized) return;

    setIsLoading(true);
    setError(null);

    try {
      const perm = getPermissionStatus();
      if (perm !== 'granted') {
        throw new Error('Notification permission not granted');
      }

      let token: string | null = null;
      let channel: 'fcm' | 'apns' = 'fcm';

      // Try to get FCM token first
      if (!isSafariWebPush()) {
        token = await getFCMToken();
        channel = 'fcm';
      } else {
        // Try Apple Web Push for Safari
        token = await getAppleWebPushToken(user.id);
        channel = 'apns';
      }

      if (!token) {
        throw new Error('Failed to get push token');
      }

      // Send token to backend
      const browserInfo = getBrowserInfo();
      await api.post('/notifications/token', {
        token,
        channel,
        browser: browserInfo.browser,
        userAgent: browserInfo.userAgent,
        platform: browserInfo.platform,
        appVersion: browserInfo.appVersion,
        deviceId: browserInfo.deviceId,
        deviceName: browserInfo.deviceName,
        language: browserInfo.language,
        timezone: browserInfo.timezone
      });

      trackEvent('notification_token_registered', {
        channel,
        platform: browserInfo.platform,
        deviceId: browserInfo.deviceId
      });

      if (browserInfo.timezone) {
        try {
          await api.put('/notifications/timezone', {
            timezone: browserInfo.timezone
          });
          trackEvent('notification_timezone_synced', {
            timezone: browserInfo.timezone
          });
        } catch (timezoneError: any) {
          console.error('Failed to sync timezone preference:', timezoneError);
          trackEvent('notification_timezone_sync_failed', {
            error: timezoneError?.message || 'unknown',
            timezone: browserInfo.timezone
          });
        }
      }

      // Setup foreground message listener
      if (foregroundListenerRef.current) {
        foregroundListenerRef.current();
      }

      foregroundListenerRef.current = setupForegroundMessageListener((payload) => {
        handleForegroundMessage(payload);
      });

      setIsInitialized(true);
    } catch (err: any) {
      console.error('Failed to initialize notifications:', err);
      setError(err.message || 'Failed to initialize notifications');
      trackEvent('notification_initialization_failed', {
        error: err.message
      });
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, user, isInitialized, trackEvent]);

  // Handle foreground messages
  const handleForegroundMessage = useCallback((payload: any) => {
    console.log('Handling foreground message:', payload);

    const { title, body } = payload.notification || payload.data || {};
    const icon = payload.notification?.icon || payload.data?.icon || '/icon-192x192.png';
    const badge = payload.notification?.badge || payload.data?.badge || '/badge-72x72.png';
    const url = payload.data?.url || '/';

    if (!title) {
      console.warn('Foreground push missing title, skipping display');
      return;
    }

    trackEvent('notification_foreground_received', {
      title,
      url,
      notificationType: payload.data?.notificationType,
      channel: payload.data?.channel
    });

    // Always show a browser notification via the service worker so users see feedback even in-focus
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.showNotification(title, {
          body: body || '',
          icon,
          badge,
          data: {
            url,
            notificationType: payload.data?.notificationType
          }
        });
      })
      .catch((error) => {
        console.error('Failed to show foreground notification via service worker:', error);

        if (Notification.permission === 'granted') {
          try {
            new Notification(title, {
              body: body || '',
              icon,
              badge
            });
          } catch (fallbackError) {
            console.error('Failed to show foreground notification via Notification API:', fallbackError);
          }
        }
      });
  }, [navigate, trackEvent]);

  // Request permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError(supportReason || 'Notifications not supported');
      trackEvent('notification_permission_request_blocked', {
        supportReason
      });
      return false;
    }

    try {
      trackEvent('notification_permission_requested');
      const perm = await requestNotificationPermission();
      setPermission(perm);

      if (perm === 'granted') {
        await initializeNotifications();
        dismissPermissionBanner('granted');
        setShowPermissionBanner(false);
        trackEvent('notification_permission_granted');
        return true;
      } else {
        setError('Notification permission denied');
        trackEvent('notification_permission_denied');
        return false;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to request permission');
      trackEvent('notification_permission_error', {
        error: err.message
      });
      return false;
    }
  }, [isSupported, supportReason, initializeNotifications, trackEvent]);

  // Dismiss permission banner
  const dismissBanner = useCallback(() => {
    dismissPermissionBanner('user');
    setShowPermissionBanner(false);
    trackEvent('notification_permission_banner_dismissed');
  }, [trackEvent]);

  // Update preferences
  const updatePreferences = useCallback(async (prefs: Partial<NotificationPreferences>) => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.put('/notifications/preferences', {
        preferences: prefs
      });

      setPreferences(response.data.preferences);
      trackEvent('notification_preferences_updated', {
        preferences: prefs
      });
    } catch (err: any) {
      console.error('Failed to update preferences:', err);
      setError(err.message || 'Failed to update preferences');
      trackEvent('notification_preferences_update_failed', {
        error: err.message
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, trackEvent]);

  // Test notification
  const testNotification = useCallback(async (type: string) => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      await api.post('/notifications/test', { type });
      trackEvent('notification_test_triggered', { type });
    } catch (err: any) {
      console.error('Failed to send test notification:', err);
      setError(err.message || 'Failed to send test notification');
      trackEvent('notification_test_failed', {
        type,
        error: err.message
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, trackEvent]);

  // Auto-initialize if permission already granted
  useEffect(() => {
    if (permission === 'granted' && !isInitialized && user) {
      initializeNotifications();
    }
  }, [permission, isInitialized, user, initializeNotifications]);

  const applyPendingServiceWorker = useCallback(async () => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      trackEvent('service_worker_update_applied', {
        version: swVersion
      });
    }
  }, [swVersion, trackEvent]);

  return {
    isSupported,
    supportReason,
    permission,
    isInitialized,
    isLoading,
    error,
    preferences,
    showPermissionBanner,
    requestPermission,
    dismissBanner,
    initializeNotifications,
    updatePreferences,
    testNotification,
    serviceWorkerVersion: swVersion,
    hasServiceWorkerUpdate: hasSwUpdate,
    applyPendingServiceWorker
  };
};
