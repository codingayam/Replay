import React, { createContext, useContext, useEffect, useState } from 'react';
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

  const getToken = async (): Promise<string | null> => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      return null;
    }
    return session.access_token;
  };

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
