import { jest } from '@jest/globals';
import {
  handleNotificationClick,
  requiresPwaInstallForPush,
  shouldShowPermissionBanner,
  markMeditationGenerated,
  markPermissionBannerShown,
  registerServiceWorker
} from '../notificationUtils';

const setUserAgent = (userAgent: string, platform: string, maxTouchPoints = 0) => {
  Object.defineProperty(window.navigator, 'userAgent', {
    value: userAgent,
    configurable: true,
  });

  Object.defineProperty(window.navigator, 'platform', {
    value: platform,
    configurable: true,
  });

  Object.defineProperty(window.navigator, 'maxTouchPoints', {
    value: maxTouchPoints,
    configurable: true,
  });
};

const setStandalone = (value: boolean | undefined) => {
  Object.defineProperty(window.navigator, 'standalone', {
    value,
    configurable: true,
  });
};

const setMatchMedia = (matches: boolean) => {
  window.matchMedia = jest.fn().mockImplementation(() => ({
    matches,
    media: '',
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })) as any;
};

const setNotificationPermission = (permission: NotificationPermission) => {
  Object.defineProperty(Notification, 'permission', {
    get: () => permission,
    configurable: true,
  });
};

describe('notificationUtils', () => {
  const MockNotification = function () {} as any;
  Object.defineProperty(global, 'Notification', {
    value: MockNotification,
    configurable: true,
  });
  MockNotification.permission = 'default';
  MockNotification.requestPermission = jest.fn();

  beforeEach(() => {
    localStorage.clear();
    setMatchMedia(false);
    setStandalone(undefined);
    setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Win32');
    setNotificationPermission('default');
    localStorage.removeItem('notification_banner_prompted');
    Object.defineProperty(window, 'PushManager', {
      value: function () {},
      configurable: true,
    });
    const defaultRegistration = {
      addEventListener: jest.fn(),
      installing: null,
      waiting: null,
      active: null,
      update: jest.fn(),
      unregister: jest.fn()
    } as unknown as ServiceWorkerRegistration;

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: jest
          .fn((script: string, opts?: RegistrationOptions) => Promise.resolve(defaultRegistration))
          .mockName('register') as unknown as ServiceWorkerContainer['register'],
        ready: Promise.resolve(defaultRegistration),
      } as unknown as ServiceWorkerContainer,
      configurable: true,
    });
  });

  describe('handleNotificationClick', () => {
    it('preserves query parameters and hash when dispatching navigation event', () => {
      let receivedPath = '';
      const listener = (event: Event) => {
        receivedPath = (event as CustomEvent).detail.path;
      };

      window.addEventListener('notification-navigation', listener);

      handleNotificationClick('/experiences?action=record#section');

      window.removeEventListener('notification-navigation', listener);
      expect(receivedPath).toBe('/experiences?action=record#section');
    });
  });

  describe('requiresPwaInstallForPush', () => {
    it('returns true for iOS Safari when not installed as PWA', () => {
      setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', 'iPhone', 5);
      setStandalone(false);

      expect(requiresPwaInstallForPush()).toBe(true);
    });

    it('returns false for iOS Safari when installed as PWA', () => {
      setUserAgent('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', 'iPad', 5);
      setStandalone(true);

      expect(requiresPwaInstallForPush()).toBe(false);
    });

    it('returns false for desktop Safari', () => {
      setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15', 'MacIntel', 0);

      expect(requiresPwaInstallForPush()).toBe(false);
    });

    it('returns false for Chromium browsers', () => {
      setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36', 'Win32', 0);

      expect(requiresPwaInstallForPush()).toBe(false);
    });
  });

  describe('shouldShowPermissionBanner', () => {
    it('returns true on first visit when permission is default', () => {
      expect(shouldShowPermissionBanner()).toBe(true);
    });

    it('returns true when permission is default and user generated a meditation', () => {
      localStorage.setItem('notification_banner_prompted', 'true');
      localStorage.setItem('has_generated_meditation', 'true');

      expect(shouldShowPermissionBanner()).toBe(true);
    });

    it('returns false when notifications already granted', () => {
      localStorage.setItem('has_generated_meditation', 'true');
      setNotificationPermission('granted');

      expect(shouldShowPermissionBanner()).toBe(false);
    });

    it('returns false when banner dismissed within 7 days', () => {
      localStorage.setItem('has_generated_meditation', 'true');
      const now = new Date().toISOString();
      localStorage.setItem('notification_banner_dismissed', now);

      expect(shouldShowPermissionBanner()).toBe(false);
    });

    it('ignores dismissal cooldown when permission resets to default', () => {
      localStorage.setItem('notification_banner_dismissed', new Date().toISOString());
      localStorage.setItem('notification_banner_dismissed_reason', 'granted');

      expect(shouldShowPermissionBanner()).toBe(true);
      expect(localStorage.getItem('notification_banner_dismissed')).toBeNull();
      expect(localStorage.getItem('notification_banner_dismissed_reason')).toBeNull();
    });
  });

  describe('markMeditationGenerated', () => {
    it('sets tracking flag and dispatches event', () => {
      const eventListener = jest.fn();
      window.addEventListener('replay-meditation-generated', eventListener);

      markMeditationGenerated();

      window.removeEventListener('replay-meditation-generated', eventListener);

      expect(localStorage.getItem('has_generated_meditation')).toBe('true');
      expect(eventListener).toHaveBeenCalled();
    });
  });

  describe('markPermissionBannerShown', () => {
    it('sets the prompted flag in localStorage', () => {
      markPermissionBannerShown();
      expect(localStorage.getItem('notification_banner_prompted')).toBe('true');
    });
  });

  describe('registerServiceWorker', () => {
    it('allows registration on 127.0.0.1 origins', async () => {
      const originalNavigator = navigator.serviceWorker;
      const originalLocation = window.location;

      Object.defineProperty(window, 'location', {
        value: {
          protocol: 'http:',
          hostname: '127.0.0.1',
        } as unknown as Location,
        configurable: true,
      });

      const mockRegistration = {
        addEventListener: jest.fn(),
        installing: null,
        waiting: null,
        active: null,
        update: jest.fn(),
        unregister: jest.fn()
      } as unknown as ServiceWorkerRegistration;

      Object.defineProperty(navigator, 'serviceWorker', {
        value: {
          register: jest
            .fn((script: string, opts?: RegistrationOptions) => Promise.resolve(mockRegistration))
            .mockName('register') as unknown as ServiceWorkerContainer['register'],
          ready: Promise.resolve(mockRegistration),
        } as unknown as ServiceWorkerContainer,
        configurable: true,
      });

      const registration = await registerServiceWorker();

      expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/firebase-messaging-sw.js', { scope: '/' });
      expect(registration).toBe(mockRegistration);

      Object.defineProperty(navigator, 'serviceWorker', {
        value: originalNavigator,
        configurable: true,
      });

      Object.defineProperty(window, 'location', {
        value: originalLocation,
        configurable: true,
      });
    });
  });
});
