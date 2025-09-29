import React, { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react';
import type { AxiosError } from 'axios';
import { useAuthenticatedApi } from '../utils/api';
import type { WeeklyProgressResponse, WeeklyProgressSummary, WeeklyProgressThresholds } from '../hooks/useWeeklyProgress';

interface WeeklyProgressState {
  summary: WeeklyProgressSummary | null;
  weekStart: string | null;
  timezone: string | null;
  thresholds: WeeklyProgressThresholds | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const WeeklyProgressContext = createContext<WeeklyProgressState | undefined>(undefined);

interface WeeklyProgressProviderProps {
  children: React.ReactNode;
  autoRefresh?: boolean;
  clientOverride?: { get: (url: string) => Promise<{ data: WeeklyProgressResponse }> };
}

export const WeeklyProgressProvider: React.FC<WeeklyProgressProviderProps> = ({ children, autoRefresh = true, clientOverride }) => {
  const authenticatedApi = useAuthenticatedApi();
  const api = clientOverride ?? authenticatedApi;
  const [state, setState] = useState<Omit<WeeklyProgressState, 'refresh'>>({
    summary: null,
    weekStart: null,
    timezone: null,
    thresholds: null,
    isLoading: autoRefresh,
    error: null
  });

  const refresh = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true }));
      const response = await api.get('/progress/week');
      const data = response.data as WeeklyProgressResponse;

      setState({
        summary: data.weeklyProgress ?? null,
        weekStart: data.weekStart ?? null,
        timezone: data.timezone ?? null,
        thresholds: data.thresholds ?? null,
        isLoading: false,
        error: null
      });
    } catch (error) {
      const axiosError = error as AxiosError<{ error?: string }>;
      const message = axiosError.response?.data?.error || axiosError.message || 'Failed to load weekly progress';
      setState((prev) => ({ ...prev, isLoading: false, error: message }));
    }
  }, [api]);

  useEffect(() => {
    if (autoRefresh) {
      refresh();
    }
  }, [autoRefresh, refresh]);

  const value = useMemo<WeeklyProgressState>(
    () => ({
      ...state,
      refresh
    }),
    [state, refresh]
  );

  return (
    <WeeklyProgressContext.Provider value={value}>
      {children}
    </WeeklyProgressContext.Provider>
  );
};

export function useWeeklyProgressContext(): WeeklyProgressState {
  const ctx = useContext(WeeklyProgressContext);
  if (!ctx) {
    throw new Error('useWeeklyProgressContext must be used within WeeklyProgressProvider');
  }
  return ctx;
}
