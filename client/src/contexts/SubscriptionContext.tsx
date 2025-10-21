import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuthenticatedApi } from '../utils/api';
import { useAuth } from './AuthContext';

interface MeditationUsage {
  weeklyCount: number;
  weeklyLimit: number;
  remaining: number;
  weekStart: string | null;
  weekResetAt: string | null;
}

interface SubscriptionContextValue {
  isPremium: boolean;
  isLoading: boolean;
  expiresAt: string | null;
  meditations: MeditationUsage | null;
  refresh: () => Promise<void>;
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
  meditations: MeditationUsage | null;
  isLoading: boolean;
  lastUpdated: string | null;
}

const initialState: ProviderState = {
  isPremium: false,
  expiresAt: null,
  meditations: null,
  isLoading: false,
  lastUpdated: null
};

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const api = useAuthenticatedApi();
  const { user, authReady, loading: authLoading } = useAuth();
  const [state, setState] = useState<ProviderState>(initialState);

  const resetState = useCallback(() => {
    setState(initialState);
  }, []);

  const fetchStatus = useCallback(async () => {
    if (!authReady || authLoading || !user) {
      resetState();
      return;
    }

    try {
      setState((prev) => ({ ...prev, isLoading: true }));
      const response = await api.get('/subscription/status');
      const { entitlements, limits } = response.data ?? {};
      const meditations: MeditationUsage | null = limits?.meditations
        ? {
            weeklyCount: limits.meditations.weeklyCount ?? 0,
            weeklyLimit: limits.meditations.weeklyLimit ?? 0,
            remaining: limits.meditations.remaining ?? 0,
            weekStart: limits.meditations.weekStart ?? null,
            weekResetAt: limits.meditations.weekResetAt ?? null
          }
        : null;

      setState({
        isPremium: Boolean(entitlements?.isPremium),
        expiresAt: entitlements?.expiresAt ?? null,
        meditations,
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

      if (url.pathname.includes(':app_user_id')) {
        url.pathname = url.pathname.replace(':app_user_id', encodeURIComponent(user.id));
      } else {
        const trimmedPath = url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname;
        url.pathname = `${trimmedPath}/${encodeURIComponent(user.id)}`;
      }

      url.searchParams.delete('app_user_id');
      resolvedUrl = url.toString();
    } catch (error) {
      console.warn('[Subscription] Provided paywall link appears relative; applying path fallback.', error);
      const separator = link.endsWith('/') ? '' : '/';
      resolvedUrl = `${link}${separator}${encodeURIComponent(user.id)}`;
    }

    window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
    setTimeout(() => {
      void fetchStatus();
    }, 4000);
  }, [fetchStatus, user?.id]);

  const value = useMemo<SubscriptionContextValue>(() => ({
    isPremium: state.isPremium,
    isLoading: state.isLoading,
    expiresAt: state.expiresAt,
    meditations: state.meditations,
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
