import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { validatePasswordStrength } from '../utils/passwordPolicy';

interface AuthContextType {
  user: any | null; // Simplified to avoid import issues
  session: any | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ user: any | null; error: any | null }>;
  signIn: (email: string, password: string) => Promise<{ user: any | null; error: any | null }>;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
  signInWithGoogle: () => Promise<{ error: any | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const testAuth = (globalThis as any).__REPLAY_TEST_AUTH__ as AuthContextType | undefined;
  if (testAuth) {
    return testAuth;
  }

  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [session, setSession] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const hasRequestedPushPermission = useRef(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const allowedOrigins = [
      'https://replay.agrix.ai',
      'https://localhost:5173',
      'http://localhost:5173'
    ];
    const currentOrigin = window.location.origin;

    if (!allowedOrigins.includes(currentOrigin)) {
      return;
    }

    const storeSubscriptionId = (subscriptionId: string | null | undefined) => {
      try {
        if (!subscriptionId) {
          window.localStorage.removeItem('onesignal_subscription_id');
        } else {
          window.localStorage.setItem('onesignal_subscription_id', subscriptionId);
        }
      } catch (storageError) {
        console.warn('[OneSignal] Failed to store subscription id:', storageError);
      }
    };

    const registerWithOneSignal = async (oneSignal: any) => {
      try {
        if (user?.id) {
          const permissionState = oneSignal?.Notifications?.permissionNative ?? oneSignal?.Notifications?.permission;
          const shouldPrompt = permissionState === 'default' || permissionState === undefined;

          if (!hasRequestedPushPermission.current && shouldPrompt) {
            hasRequestedPushPermission.current = true;

            if (oneSignal?.Slidedown?.promptPush) {
              await oneSignal.Slidedown.promptPush();
            } else if (oneSignal?.Notifications?.requestPermission) {
              await oneSignal.Notifications.requestPermission();
            }
          }
        } else {
          hasRequestedPushPermission.current = false;
          storeSubscriptionId(null);
        }

        const existingId = await oneSignal?.User?.PushSubscription?.getId?.();
        if (existingId) {
          storeSubscriptionId(existingId);
        }

        if (typeof oneSignal?.User?.PushSubscription?.addEventListener === 'function') {
          oneSignal.User.PushSubscription.addEventListener('change', (event: any) => {
            const newId = event?.current?.id ?? null;
            storeSubscriptionId(newId);
          });
        }
      } catch (error) {
        console.error('Failed to synchronize OneSignal session:', error);
      }
    };

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push((oneSignal: any) => {
      registerWithOneSignal(oneSignal);
    });

  }, [user?.id]);

  useEffect(() => {
    if (!user && typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem('onesignal_subscription_id');
      } catch (error) {
        console.warn('[OneSignal] Failed to clear subscription id:', error);
      }
    }
  }, [user]);

  const signUp = async (email: string, password: string) => {
    const { isValid, failedRuleLabels } = validatePasswordStrength(password);
    if (!isValid) {
      return {
        user: null,
        error: {
          message: `Password requirements not met: ${failedRuleLabels.join(', ')}`,
        },
      };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    // Check if the error indicates user already exists
    if (error && (
      error.message.includes('User already registered') ||
      error.message.includes('already registered') ||
      error.message.includes('already been registered')
    )) {
      return {
        user: null,
        error: { message: 'An account with this email already exists. Please sign in instead.' }
      };
    }

    return { user: data.user, error };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { user: data.user, error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const signInWithGoogle = async (): Promise<{ error: any | null }> => {
    const redirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback`
        : undefined;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        scopes: 'https://www.googleapis.com/auth/userinfo.email profile',
      },
    });

    return { error };
  };

  const getToken = useCallback(async (): Promise<string | null> => {
    try {
      let activeSession = session;

      if (!activeSession) {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Failed to retrieve auth session:', error);
          return null;
        }

        activeSession = data.session ?? null;

        if (activeSession) {
          setSession(activeSession);
          setUser(activeSession.user ?? null);
        }
      }

      if (!activeSession) {
        return null;
      }

      const expiresAtMs = activeSession.expires_at ? activeSession.expires_at * 1000 : null;
      const needsRefresh = typeof expiresAtMs === 'number' && expiresAtMs - Date.now() < 60_000;

      if (needsRefresh) {
        const { data, error } = await supabase.auth.refreshSession();

        if (error || !data.session) {
          console.error('Failed to refresh auth session:', error);
          return null;
        }

        activeSession = data.session;
        setSession(activeSession);
        setUser(activeSession.user ?? null);
      }

      return activeSession.access_token ?? null;
    } catch (error) {
      console.error('Error retrieving auth token:', error);
      return null;
    }
  }, [session]);

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    getToken,
    signInWithGoogle,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Helper components for conditional rendering
export const SignedIn: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  return user ? <>{children}</> : null;
};

export const SignedOut: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  return !user ? <>{children}</> : null;
};
