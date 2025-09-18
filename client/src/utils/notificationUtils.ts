import { getToken, onMessage } from 'firebase/messaging';
import { messaging, firebaseVapidKey } from '../lib/firebase';

// Browser capability detection
export const isPushSupported = (): boolean => {
  return 'Notification' in window &&
         'serviceWorker' in navigator &&
         'PushManager' in window;
};

const safariWebPushConfig = ((): { webPushId?: string; packagePath?: string } => {
  if (typeof window !== 'undefined' && (window as any).__REPLAY_SAFARI_WEB_PUSH_CONFIG__) {
    return (window as any).__REPLAY_SAFARI_WEB_PUSH_CONFIG__;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).__REPLAY_SAFARI_WEB_PUSH_CONFIG__) {
    return (globalThis as any).__REPLAY_SAFARI_WEB_PUSH_CONFIG__;
  }
  return {};
})();

const SAFARI_WEB_PUSH_ID = safariWebPushConfig.webPushId || 'web.com.replay.app';
const SAFARI_WEB_PUSH_PACKAGE_PATH = safariWebPushConfig.packagePath || `/pushPackages/${SAFARI_WEB_PUSH_ID}`;

const isIosDevice = (): boolean => {
  const ua = window.navigator.userAgent;
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return /iPad|iPhone|iPod/.test(ua) || iPadOS;
};

export const isSafariWebPush = (): boolean => {
  const ua = navigator.userAgent;
  const isSafari = /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(ua);
  return isSafari;
};

export const requiresPwaInstallForPush = (): boolean => {
  // iOS Safari requires installation as a PWA for Web Push support.
  if (!(isSafariWebPush() && isIosDevice())) {
    return false;
  }

  const displayModeStandalone = typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches;
  const navigatorStandalone = (window.navigator as any).standalone === true;

  return !(displayModeStandalone || navigatorStandalone);
};

export const checkNotificationSupport = () => {
  if (!isPushSupported()) {
    return {
      supported: false,
      reason: 'Browser does not support push notifications'
    };
  }

  if (requiresPwaInstallForPush()) {
    return {
      supported: false,
      reason: 'Please install this app to your home screen to enable notifications on Safari'
    };
  }

  return { supported: true };
};

// Permission management
export const getPermissionStatus = (): NotificationPermission => {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
};

export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!isPushSupported()) {
    throw new Error('Push notifications not supported');
  }

  const permission = await Notification.requestPermission();
  return permission;
};

// FCM Token management
export const getFCMToken = async (): Promise<string | null> => {
  try {
    // Check if service worker is registered
    const registration = await navigator.serviceWorker.ready;

    const token = await getToken(messaging, {
      vapidKey: firebaseVapidKey,
      serviceWorkerRegistration: registration
    });

    if (token) {
      console.log('FCM token received:', token.substring(0, 20) + '...');
      return token;
    } else {
      console.error('No FCM token available');
      return null;
    }
  } catch (error) {
    console.error('Failed to get FCM token:', error);
    return null;
  }
};

// Apple Web Push token management (Safari)
export const getAppleWebPushToken = async (userId: string): Promise<string | null> => {
  const safariPush = (window as any)?.safari?.pushNotification;

  if (!safariPush) {
    console.log('Safari push not available');
    return null;
  }

  try {
    // Request permission from Safari
    const permission = await new Promise<any>((resolve) => {
      safariPush.requestPermission(
        SAFARI_WEB_PUSH_PACKAGE_PATH,
        SAFARI_WEB_PUSH_ID,
        { userId },
        resolve
      );
    });

    if (permission.permission === 'granted' && permission.deviceToken) {
      console.log('Apple Web Push token received:', permission.deviceToken.substring(0, 20) + '...');
      return permission.deviceToken;
    }

    return null;
  } catch (error) {
    console.error('Failed to get Apple Web Push token:', error);
    return null;
  }
};

// Service worker registration
export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!('serviceWorker' in navigator)) {
    console.error('Service workers not supported');
    return null;
  }

  try {
    const isLocalHost = ['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname);
    const isSecureContext = window.isSecureContext || window.location.protocol === 'https:' || isLocalHost;

    if (!isSecureContext) {
      console.error('Service workers require HTTPS');
      return null;
    }

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/'
    });

    console.log('Service worker registered:', registration);

    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) {
        return;
      }

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          window.dispatchEvent(new CustomEvent('replay-sw-update-available'));
        }
      });
    });

    // Wait for the service worker to be ready
    await navigator.serviceWorker.ready;

    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    return registration;
  } catch (error) {
    console.error('Service worker registration failed:', error);
    return null;
  }
};

// Listen for service worker messages
export const listenForServiceWorkerMessages = (callback: (data: any) => void): (() => void) => {
  if (!('serviceWorker' in navigator)) return () => {};

  const handler = (event: MessageEvent) => {
    console.log('Received message from service worker:', event.data);
    callback(event.data);
  };

  navigator.serviceWorker.addEventListener('message', handler);

  return () => {
    navigator.serviceWorker.removeEventListener('message', handler);
  };
};

export const requestServiceWorkerVersion = async (): Promise<string | null> => {
  if (!('serviceWorker' in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.ready;
    const controller = registration?.active || navigator.serviceWorker.controller;
    if (!controller) return null;

    return await new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      const timeout = setTimeout(() => {
        reject(new Error('Service worker version request timed out'));
      }, 3000);

      channel.port1.onmessage = (event) => {
        clearTimeout(timeout);
        resolve(event.data?.version || null);
      };

      controller.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
    });
  } catch (error) {
    console.error('Failed to get service worker version:', error);
    return null;
  }
};

// Setup foreground message listener
export const setupForegroundMessageListener = (callback: (payload: any) => void) => {
  return onMessage(messaging, (payload) => {
    console.log('Foreground message received:', payload);
    callback(payload);
  });
};

// Get browser info for backend
const DEVICE_ID_STORAGE_KEY = 'replay_notification_device_id';
const BANNER_DISMISSED_KEY = 'notification_banner_dismissed';
const BANNER_PROMPTED_KEY = 'notification_banner_prompted';

const getOrCreateDeviceId = (): string | null => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  try {
    const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing) {
      return existing;
    }

    const generated = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    localStorage.setItem(DEVICE_ID_STORAGE_KEY, generated);
    return generated;
  } catch (error) {
    console.warn('Unable to persist device identifier:', error);
    return null;
  }
};

export const getBrowserInfo = () => {
  const userAgent = navigator.userAgent;
  let browser = 'Unknown';

  if (userAgent.includes('Chrome')) browser = 'Chrome';
  else if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Safari')) browser = 'Safari';
  else if (userAgent.includes('Edge')) browser = 'Edge';

  const uaData = (navigator as any).userAgentData;
  const deviceName = uaData?.platform || navigator.platform || browser;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return {
    browser,
    userAgent,
    platform: navigator.platform,
    language: navigator.language,
    appVersion: navigator.appVersion,
    deviceId: getOrCreateDeviceId(),
    deviceName,
    timezone
  };
};

// Deep link handling
export const handleNotificationClick = (url: string) => {
  // This will be called from the service worker message
  // The actual navigation will be handled by React Router
  console.log('Handling notification click for URL:', url);

  // Parse the URL and extract the path
  const targetUrl = new URL(url, window.location.origin);
  const pathWithQuery = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;

  // Dispatch a custom event that the app can listen to
  window.dispatchEvent(new CustomEvent('notification-navigation', {
    detail: { path: pathWithQuery }
  }));
};

// Check if should show permission banner
export const shouldShowPermissionBanner = (): boolean => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return false;
  }

  if (!isPushSupported()) return false;

  if (Notification.permission !== 'default') return false;

  const lastDismissed = localStorage.getItem(BANNER_DISMISSED_KEY);
  if (lastDismissed) {
    const dismissedDate = new Date(lastDismissed);
    const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceDismissed < 7) return false;
  }

  const hasBeenPrompted = localStorage.getItem(BANNER_PROMPTED_KEY) === 'true';
  if (!hasBeenPrompted) {
    return true;
  }

  const hasGeneratedMeditation = localStorage.getItem('has_generated_meditation') === 'true';
  return hasGeneratedMeditation;
};

// Mark banner as dismissed
export const dismissPermissionBanner = () => {
  localStorage.setItem(BANNER_DISMISSED_KEY, new Date().toISOString());
};

// Record that the banner has been shown at least once.
export const markPermissionBannerShown = () => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }
  localStorage.setItem(BANNER_PROMPTED_KEY, 'true');
};

// Mark that user has generated a meditation
export const markMeditationGenerated = () => {
  if (typeof window === 'undefined') return;

  localStorage.setItem('has_generated_meditation', 'true');
  window.dispatchEvent(new Event('replay-meditation-generated'));
};
