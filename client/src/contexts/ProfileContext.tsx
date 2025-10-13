import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import type { AxiosError } from 'axios';
import { useAuthenticatedApi } from '../utils/api';
import { useAuth } from './AuthContext';

export interface ProfileRecord {
  id?: string;
  user_id?: string;
  name?: string | null;
  values?: string[] | string | null;
  mission?: string | null;
  thinking_about?: string | null;
  profile_image_url?: string | null;
  onboarding_step?: number | null;
  onboarding_completed?: boolean | null;
  [key: string]: unknown;
}

interface ProfileContextValue {
  profile: ProfileRecord | null;
  isLoading: boolean;
  error: string | null;
  refreshProfile: () => Promise<void>;
  isOnboarded: boolean;
  currentStep: number;
  totalSteps: number;
  setCurrentStep: (step: number) => void;
  updateLocalProfile: (updates: Partial<ProfileRecord>) => void;
}

const TOTAL_STEPS = 6;

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

export const useProfile = (): ProfileContextValue => {
  const testContext = (globalThis as any).__REPLAY_TEST_PROFILE_CONTEXT__;
  if (testContext) {
    return testContext;
  }

  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};

interface ProfileProviderProps {
  children: React.ReactNode;
}

export const ProfileProvider: React.FC<ProfileProviderProps> = ({ children }) => {
  const { user, loading: authLoading, authReady } = useAuth();
  const api = useAuthenticatedApi();
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStepState] = useState<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const resolveStep = useCallback((record: ProfileRecord | null) => {
    if (!record) {
      return 0;
    }

    if (record.onboarding_completed) {
      return TOTAL_STEPS;
    }

    const serverStep = typeof record.onboarding_step === 'number' ? record.onboarding_step : 0;
    if (serverStep > TOTAL_STEPS) {
      return TOTAL_STEPS;
    }
    if (serverStep < 0) {
      return 0;
    }
    return serverStep;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user || !authReady) {
      setProfile(null);
      setCurrentStepState(0);
      return;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get('/profile', { signal: controller.signal });
      const record: ProfileRecord | null = response.data?.profile ?? null;

      setProfile(record);
      setCurrentStepState(resolveStep(record));
    } catch (err) {
      if ((err as any)?.name === 'CanceledError') {
        return;
      }

      const axiosError = err as AxiosError<{ error?: string }>;
      const message = axiosError.response?.data?.error || axiosError.message || 'Failed to load profile';
      setError(message);
      setProfile(null);
      setCurrentStepState(0);
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [api, authReady, resolveStep, user]);

  useEffect(() => {
    if (authLoading || !authReady) {
      return;
    }
    refreshProfile();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [authLoading, authReady, refreshProfile]);

  const setCurrentStep = useCallback((step: number) => {
    setCurrentStepState(prev => {
      if (step === prev) {
        return prev;
      }
      if (step < 0) {
        return 0;
      }
      if (step > TOTAL_STEPS) {
        return TOTAL_STEPS;
      }
      return step;
    });
  }, []);

  const updateLocalProfile = useCallback((updates: Partial<ProfileRecord>) => {
    setProfile(prev => ({
      ...(prev ?? {}),
      ...updates
    }));
  }, []);

  const isOnboarded = useMemo(() => {
    if (!profile) {
      return false;
    }
    if (profile.onboarding_completed) {
      return true;
    }
    return currentStep >= TOTAL_STEPS;
  }, [currentStep, profile]);

  const value = useMemo<ProfileContextValue>(() => ({
    profile,
    isLoading,
    error,
    refreshProfile,
    isOnboarded,
    currentStep,
    totalSteps: TOTAL_STEPS,
    setCurrentStep,
    updateLocalProfile
  }), [currentStep, error, isLoading, isOnboarded, profile, refreshProfile, setCurrentStep, updateLocalProfile]);

  if ((globalThis as any).__REPLAY_TEST_PROFILE_CONTEXT__) {
    return <>{children}</>;
  }

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
};

export const __PROFILE_TEST_CONSTANTS__ = {
  TOTAL_STEPS
};
