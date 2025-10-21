import { jest } from '@jest/globals';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';

// Mock OneSignal
const mockOneSignalLogin = jest.fn<(userId: string) => Promise<void>>();
const mockOneSignalLogout = jest.fn<() => Promise<void>>();
const mockGetId = jest.fn<() => Promise<string | null>>();
const mockAddEventListener = jest.fn();
const mockSlidedownPromptPush = jest.fn<() => Promise<void>>();
const mockRequestPermission = jest.fn<() => Promise<void>>();

const mockOneSignal = {
  login: mockOneSignalLogin,
  logout: mockOneSignalLogout,
  User: {
    PushSubscription: {
      getId: mockGetId,
      addEventListener: mockAddEventListener
    }
  },
  Notifications: {
    permissionNative: 'default',
    requestPermission: mockRequestPermission
  },
  Slidedown: {
    promptPush: mockSlidedownPromptPush
  }
};

// Setup window.OneSignalDeferred and browser globals
beforeAll(() => {
  (window as any).OneSignalDeferred = [];

  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn()
    }
  });

  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      origin: 'https://replay-ai.app'
    }
  });
});

const setWindowOrigin = (origin: string) => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { origin }
  });
};

const runDeferredOneSignalCallbacks = async () => {
  const callbacks = [...((window as any).OneSignalDeferred || [])];
  (window as any).OneSignalDeferred = [];
  for (const callback of callbacks) {
    await callback(mockOneSignal);
  }
};

// Mock Supabase
type SupabaseAuthMock = {
  getSession: jest.MockedFunction<() => Promise<{ data: { session: any } }>>;
  onAuthStateChange: jest.MockedFunction<
    (callback: (event: string, session: any) => void) => {
      data: { subscription: { unsubscribe: () => void } };
    }
  >;
  signUp: jest.Mock;
  signInWithPassword: jest.Mock;
  signOut: jest.MockedFunction<() => Promise<void>>;
  signInWithOAuth: jest.Mock;
};

const mockSupabaseAuth: SupabaseAuthMock = {
  getSession: jest.fn(),
  onAuthStateChange: jest.fn(),
  signUp: jest.fn(),
  signInWithPassword: jest.fn(),
  signOut: jest.fn(),
  signInWithOAuth: jest.fn()
};

let AuthProvider: any;
let useAuth: any;

beforeAll(async () => {
  await jest.unstable_mockModule('../../lib/supabase', () => ({
    supabase: {
      auth: mockSupabaseAuth
    }
  }));
  const authModule = await import('../AuthContext');
  AuthProvider = authModule.AuthProvider;
  useAuth = authModule.useAuth;
});

describe('AuthContext - OneSignal Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (window as any).OneSignalDeferred = [];

    (window.localStorage.getItem as jest.Mock).mockReset();
    (window.localStorage.setItem as jest.Mock).mockReset();
    (window.localStorage.removeItem as jest.Mock).mockReset();

    mockSupabaseAuth.getSession.mockResolvedValue({
      data: { session: null }
    });

    mockSupabaseAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } }
    });

    mockOneSignalLogin.mockResolvedValue(undefined);
    mockOneSignalLogout.mockResolvedValue(undefined);
    mockGetId.mockResolvedValue('subscription-id-123');
    mockSlidedownPromptPush.mockResolvedValue(undefined);
    mockRequestPermission.mockResolvedValue(undefined);
  });

  test('calls OneSignal.login when user authenticates', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    const mockSession = { user: mockUser, access_token: 'token-123' };

    mockSupabaseAuth.getSession.mockResolvedValue({
      data: { session: mockSession }
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Wait for auth to load
    await waitFor(() => {
      expect(mockSupabaseAuth.getSession).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
    });

    // Trigger OneSignal callback
    await act(async () => {
      await runDeferredOneSignalCallbacks();
    });

    await waitFor(() => {
      expect(mockOneSignalLogin).toHaveBeenCalledWith('user-123');
    });
  });

  test('calls OneSignal.logout when user signs out', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };

    // Start with authenticated user
    mockSupabaseAuth.getSession.mockResolvedValue({
      data: { session: { user: mockUser, access_token: 'token' } }
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(mockSupabaseAuth.getSession).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
    });

    // Trigger OneSignal callback with user
    await act(async () => {
      await runDeferredOneSignalCallbacks();
    });

    // Now sign out
    mockSupabaseAuth.getSession.mockResolvedValue({
      data: { session: null }
    });

    // Simulate auth state change to null
    await act(async () => {
      const authChangeCallback = mockSupabaseAuth.onAuthStateChange.mock.calls[0][0];
      authChangeCallback('SIGNED_OUT', null);
    });

    // Re-trigger OneSignal callback without user
    await act(async () => {
      await runDeferredOneSignalCallbacks();
    });

    await waitFor(() => {
      expect(mockOneSignalLogout).toHaveBeenCalled();
    });
  });

  test('stores subscription ID in localStorage', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    mockSupabaseAuth.getSession.mockResolvedValue({
      data: { session: { user: mockUser, access_token: 'token' } }
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(mockSupabaseAuth.getSession).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
    });

    await act(async () => {
      await runDeferredOneSignalCallbacks();
    });

    await waitFor(() => {
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        'onesignal_subscription_id',
        'subscription-id-123'
      );
    });
  });

  test('prompts for push notification permission', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    mockSupabaseAuth.getSession.mockResolvedValue({
      data: { session: { user: mockUser, access_token: 'token' } }
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(mockSupabaseAuth.getSession).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
    });

    await act(async () => {
      await runDeferredOneSignalCallbacks();
    });

    await waitFor(() => {
      expect(mockSlidedownPromptPush).toHaveBeenCalled();
    });
  });

  test('handles OneSignal login failure gracefully', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const mockUser = { id: 'user-123', email: 'test@example.com' };

    mockSupabaseAuth.getSession.mockResolvedValue({
      data: { session: { user: mockUser, access_token: 'token' } }
    });

    mockOneSignalLogin.mockRejectedValue(new Error('Login failed'));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(mockSupabaseAuth.getSession).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
    });

    await act(async () => {
      await runDeferredOneSignalCallbacks();
    });

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[OneSignal] Login failed'),
        expect.any(Error)
      );
    });

    consoleErrorSpy.mockRestore();
  });

  test('clears subscription ID when user signs out', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };

    // Start authenticated
    mockSupabaseAuth.getSession.mockResolvedValue({
      data: { session: { user: mockUser, access_token: 'token' } }
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(mockSupabaseAuth.getSession).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
    });

    // Sign out
    await act(async () => {
      const authChangeCallback = mockSupabaseAuth.onAuthStateChange.mock.calls[0][0];
      authChangeCallback('SIGNED_OUT', null);
    });

    await waitFor(() => {
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('onesignal_subscription_id');
    });
  });

  test('does not initialize OneSignal on disallowed origins', async () => {
    setWindowOrigin('http://localhost:3000'); // Not in allowed list

    const mockUser = { id: 'user-123', email: 'test@example.com' };
    mockSupabaseAuth.getSession.mockResolvedValue({
      data: { session: { user: mockUser, access_token: 'token' } }
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(mockSupabaseAuth.getSession).toHaveBeenCalled();
    });

    // OneSignal methods should not be called
    expect(mockOneSignalLogin).not.toHaveBeenCalled();

    // Reset for other tests
    setWindowOrigin('https://replay-ai.app');
  });
});
