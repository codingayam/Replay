import { useWeeklyProgressContext } from '../contexts/WeeklyProgressContext';

export interface WeeklyProgressSummary {
  weekStart: string | null;
  journalCount: number;
  meditationCount: number;
  meditationsUnlocked: boolean;
  reportReady: boolean;
  reportSent: boolean;
  timezone: string;
  unlocksRemaining: number;
  reportJournalRemaining: number;
  reportMeditationRemaining: number;
  nextReportDate: string | null;
  eligible: boolean;
  nextReportAtUtc: string | null;
  weekTimezone?: string | null;
}

export interface WeeklyProgressThresholds {
  unlockMeditations: number;
  weeklyJournals: number;
  weeklyMeditations: number;
  reportJournals: number;
  reportMeditations: number;
}

export interface WeeklyProgressResponse {
  weekStart: string | null;
  timezone: string;
  weeklyProgress: WeeklyProgressSummary | null;
  thresholds?: WeeklyProgressThresholds;
}

interface UseWeeklyProgressResult {
  summary: WeeklyProgressSummary | null;
  weekStart: string | null;
  timezone: string | null;
  thresholds: WeeklyProgressThresholds | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useWeeklyProgress(): UseWeeklyProgressResult {
  const context = useWeeklyProgressContext();
  return context;
}

export default useWeeklyProgress;
