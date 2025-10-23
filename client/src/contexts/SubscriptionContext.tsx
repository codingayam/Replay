import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthenticatedApi } from '../utils/api';
import { useAuth } from './AuthContext';

interface UsageDetails {
  total: number;
  limit: number;
  remaining: number;
}

interface RefreshOptions {
  force?: boolean;
}

interface SubscriptionContextValue {
  isPremium: boolean;
  isLoading: boolean;
  expiresAt: string | null;
  meditations: UsageDetails | null;
  journals: UsageDetails | null;
  refresh: (options?: RefreshOptions) => Promise<void>;
  showPaywall: () => void;
  lastUpdated: string | null;
}

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

const getEnv = (key: string): string | undefined => {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[key]) {
    return (import.meta as any).env[key];
  }
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  const testEnv = (globalThis as any).__REPLAY_IMPORT_META_ENV__;
  if (testEnv && testEnv[key]) {
    return testEnv[key];
  }
  return undefined;
};

interface ProviderState {
  isPremium: boolean;
  expiresAt: string | null;
  meditations: UsageDetails | null;
  journals: UsageDetails | null;
  isLoading: boolean;
  lastUpdated: string | null;
}

const initialState: ProviderState = {
  isPremium: false,
  expiresAt: null,
  meditations: null,
  journals: null,
  isLoading: false,
  lastUpdated: null
};

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const api = useAuthenticatedApi();
  const { user, authReady, loading: authLoading } = useAuth();
  const [state, setState] = useState<ProviderState>(initialState);
  const paywallRefreshPendingRef = useRef(false);
  const paywallRefreshTimerRef = useRef<number | null>(null);

  const resetState = useCallback(() => {
    setState(initialState);
  }, []);

  const fetchStatus = useCallback(async (options?: RefreshOptions) => {
    if (!authReady || authLoading || !user) {
      resetState();
      return;
    }

    try {
      setState((prev) => ({ ...prev, isLoading: true }));
      const response = await api.get('/subscription/status', {
        params: options?.force ? { forceRefresh: 'true' } : undefined
      });
      const { entitlements, limits } = response.data ?? {};
      const meditations: UsageDetails | null = limits?.meditations
        ? {
            total: limits.meditations.total ?? 0,
            limit: limits.meditations.limit ?? 0,
            remaining: limits.meditations.remaining ?? 0
          }
        : null;
      const journals: UsageDetails | null = limits?.journals
        ? {
            total: limits.journals.total ?? 0,
            limit: limits.journals.limit ?? 0,
            remaining: limits.journals.remaining ?? 0
          }
        : null;

      setState({
        isPremium: Boolean(entitlements?.isPremium),
        expiresAt: entitlements?.expiresAt ?? null,
        meditations,
        journals,
        isLoading: false,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error('[Subscription] Failed to load status:', error);
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [api, authReady, authLoading, resetState, user]);

  useEffect(() => {
    if (!authReady || authLoading) {
      return;
    }
    if (!user) {
      resetState();
      return;
    }
    void fetchStatus();
  }, [authReady, authLoading, user, fetchStatus, resetState]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleFocus = () => {
      if (!paywallRefreshPendingRef.current) {
        return;
      }
      paywallRefreshPendingRef.current = false;
      const timerId = paywallRefreshTimerRef.current;
      if (timerId !== null) {
        window.clearTimeout(timerId);
        paywallRefreshTimerRef.current = null;
      }
      void fetchStatus({ force: true });
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      const timerId = paywallRefreshTimerRef.current;
      if (timerId !== null) {
        window.clearTimeout(timerId);
        paywallRefreshTimerRef.current = null;
      }
    };
  }, [fetchStatus]);

  const showPaywall = useCallback(() => {
    const link = getEnv('VITE_REVENUECAT_WEB_PURCHASE_LINK');
    if (!link) {
      console.warn('[Subscription] Missing VITE_REVENUECAT_WEB_PURCHASE_LINK env variable');
      alert('Upgrade link is not configured yet. Please contact support.');
      return;
    }
    if (!user?.id) {
      console.warn('[Subscription] Cannot open paywall without authenticated user id');
      alert('Please sign in again to manage your subscription.');
      return;
    }

    let resolvedUrl = link;
    try {
      const url = new URL(link, window.location.origin);
      const encodedUserId = encodeURIComponent(user.id);

      if (url.pathname.includes(':app_user_id')) {
        url.pathname = url.pathname.replace(':app_user_id', encodedUserId);
      } else {
        const trimmedPath = url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname;
        url.pathname = `${trimmedPath}/${encodedUserId}`;
      }

      url.searchParams.set('app_user_id', user.id);
      resolvedUrl = url.toString();
    } catch (error) {
      console.warn('[Subscription] Provided paywall link appears relative; applying path fallback.', error);
      const encodedUserId = encodeURIComponent(user.id);
      const linkWithPath = link.includes(':app_user_id')
        ? link.replace(':app_user_id', encodedUserId)
        : `${link}${link.endsWith('/') ? '' : '/'}${encodedUserId}`;
      const joiner = linkWithPath.includes('?') ? '&' : '?';
      resolvedUrl = `${linkWithPath}${joiner}app_user_id=${encodedUserId}`;
    }

    window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
    paywallRefreshPendingRef.current = true;
    paywallRefreshTimerRef.current = window.setTimeout(() => {
      paywallRefreshPendingRef.current = false;
      void fetchStatus({ force: true });
      paywallRefreshTimerRef.current = null;
    }, 4000);
  }, [fetchStatus, user?.id]);

  const value = useMemo<SubscriptionContextValue>(() => ({
    isPremium: state.isPremium,
    isLoading: state.isLoading,
    expiresAt: state.expiresAt,
    meditations: state.meditations,
    journals: state.journals,
    refresh: fetchStatus,
    showPaywall,
    lastUpdated: state.lastUpdated
  }), [state, fetchStatus, showPaywall]);

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export function useSubscription(): SubscriptionContextValue {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}
