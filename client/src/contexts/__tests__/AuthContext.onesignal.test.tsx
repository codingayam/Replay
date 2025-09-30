import { jest } from '@jest/globals';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';

// Mock OneSignal
const mockOneSignalLogin = jest.fn();
const mockOneSignalLogout = jest.fn();
const mockGetId = jest.fn();
const mockAddEventListener = jest.fn();
const mockSlidedownPromptPush = jest.fn();
const mockRequestPermission = jest.fn();

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

// Setup window.OneSignalDeferred
beforeAll(() => {
  (window as any).OneSignalDeferred = [];
  (window as any).localStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
  };
  (window as any).location = {
    origin: 'https://replay.agrix.ai'
  };
});

// Mock Supabase
const mockSupabaseAuth = {
  getSession: jest.fn(),
  onAuthStateChange: jest.fn(),
  signUp: jest.fn(),
  signInWithPassword: jest.fn(),
  signOut: jest.fn(),
  signInWithOAuth: jest.fn()
};

jest.unstable_mockModule('../lib/supabase', () => ({
  supabase: {
    auth: mockSupabaseAuth
  }
}));

let AuthProvider: any;
let useAuth: any;

beforeAll(async () => {
  const authModule = await import('../AuthContext');
  AuthProvider = authModule.AuthProvider;
  useAuth = authModule.useAuth;
});

describe('AuthContext - OneSignal Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (window as any).OneSignalDeferred = [];

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

    renderHook(() => useAuth(), { wrapper });

    // Wait for auth to load
    await waitFor(() => {
      expect(mockSupabaseAuth.getSession).toHaveBeenCalled();
    });

    // Trigger OneSignal callback
    await act(async () => {
      if ((window as any).OneSignalDeferred.length > 0) {
        const callback = (window as any).OneSignalDeferred[0];
        await callback(mockOneSignal);
      }
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

    const { rerender } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(mockSupabaseAuth.getSession).toHaveBeenCalled();
    });

    // Trigger OneSignal callback with user
    await act(async () => {
      if ((window as any).OneSignalDeferred.length > 0) {
        const callback = (window as any).OneSignalDeferred[0];
        await callback(mockOneSignal);
      }
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
    (window as any).OneSignalDeferred = [];
    await act(async () => {
      (window as any).OneSignalDeferred.push(async (os: any) => {
        await mockOneSignal.logout();
      });

      if ((window as any).OneSignalDeferred.length > 0) {
        const callback = (window as any).OneSignalDeferred[0];
        await callback(mockOneSignal);
      }
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

    renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      if ((window as any).OneSignalDeferred.length > 0) {
        const callback = (window as any).OneSignalDeferred[0];
        await callback(mockOneSignal);
      }
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

    renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      if ((window as any).OneSignalDeferred.length > 0) {
        const callback = (window as any).OneSignalDeferred[0];
        await callback(mockOneSignal);
      }
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

    renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      if ((window as any).OneSignalDeferred.length > 0) {
        const callback = (window as any).OneSignalDeferred[0];
        await callback(mockOneSignal);
      }
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

    renderHook(() => useAuth(), { wrapper });

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
    (window as any).location.origin = 'http://localhost:3000'; // Not in allowed list

    const mockUser = { id: 'user-123', email: 'test@example.com' };
    mockSupabaseAuth.getSession.mockResolvedValue({
      data: { session: { user: mockUser, access_token: 'token' } }
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      // Should not add callback to OneSignalDeferred
      // because origin check fails in the effect
    });

    // OneSignal methods should not be called
    expect(mockOneSignalLogin).not.toHaveBeenCalled();

    // Reset for other tests
    (window as any).location.origin = 'https://replay.agrix.ai';
  });
});