import React from 'react';
import { jest } from '@jest/globals';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import useWeeklyProgress, { WeeklyProgressResponse } from '../hooks/useWeeklyProgress';
import { WeeklyProgressProvider } from '../contexts/WeeklyProgressContext';

interface ProgressProbeProps {
  client: { get: (url: string) => Promise<{ data: WeeklyProgressResponse }> };
}

const ProgressProbe: React.FC = () => {
  const { summary, thresholds, isLoading, error } = useWeeklyProgress();

  if (isLoading) {
    return <div data-testid="status">loading</div>;
  }

  if (error) {
    return <div data-testid="status">error</div>;
  }

  return (
    <div>
      <span data-testid="journals">{summary?.journalCount ?? 0}</span>
      <span data-testid="meditations">{summary?.meditationCount ?? 0}</span>
      <span data-testid="unlocked">{summary?.meditationsUnlocked ? 'yes' : 'no'}</span>
      <span data-testid="threshold">{thresholds?.unlockMeditations ?? 0}</span>
    </div>
  );
};

const renderWithProvider = (client: { get: (url: string) => Promise<{ data: WeeklyProgressResponse }> }) =>
  render(
    <WeeklyProgressProvider clientOverride={client}>
      <ProgressProbe />
    </WeeklyProgressProvider>
  );

describe('useWeeklyProgress hook', () => {
  const setTestAuth = (overrides: Record<string, any> = {}) => {
    const defaultGetToken = jest.fn<() => Promise<string | null>>();
    defaultGetToken.mockResolvedValue('test-token');

    const authStub = {
      user: { id: 'user-1' },
      session: {},
      loading: false,
      authReady: true,
      signUp: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      getToken: defaultGetToken,
      signInWithGoogle: jest.fn(),
      ...overrides
    };

    (globalThis as any).__REPLAY_TEST_AUTH__ = authStub;
    return authStub;
  };

  afterEach(() => {
    cleanup();
    delete (globalThis as any).__REPLAY_TEST_AUTH__;
  });

  it('fetches and exposes weekly progress data', async () => {
    setTestAuth();
    const apiGet = jest.fn();
    (apiGet as any).mockResolvedValue({
        data: {
          weekStart: '2025-05-19',
          timezone: 'America/New_York',
          thresholds: {
            unlockMeditations: 0,
            weeklyJournals: 3,
            weeklyMeditations: 1,
            reportJournals: 5,
            reportMeditations: 1
          },
          weeklyProgress: {
            weekStart: '2025-05-19',
            journalCount: 4,
            meditationCount: 1,
            meditationsUnlocked: true,
            reportReady: false,
            reportSent: false,
            timezone: 'America/New_York',
            unlocksRemaining: 0,
            reportJournalRemaining: 0,
            reportMeditationRemaining: 0,
            nextReportDate: '2025-05-26',
            weekTimezone: 'America/New_York'
          }
        }
      });
    const mockClient = {
      get: apiGet
    } as unknown as { get: (url: string) => Promise<{ data: WeeklyProgressResponse }> };

    renderWithProvider(mockClient);

    await waitFor(() => {
      expect(screen.getByTestId('journals')).toHaveTextContent('4');
    });

    expect(screen.getByTestId('meditations')).toHaveTextContent('1');
    expect(screen.getByTestId('unlocked')).toHaveTextContent('yes');
    expect(screen.getByTestId('threshold')).toHaveTextContent('0');
    expect(apiGet).toHaveBeenCalledWith('/progress/week');
  });

  it('skips fetching when there is no authenticated user', async () => {
    const nullTokenMock = jest.fn<() => Promise<string | null>>();
    nullTokenMock.mockResolvedValue(null);
    setTestAuth({ user: null, getToken: nullTokenMock, loading: false });

    const apiGet = jest.fn();
    const mockClient = {
      get: apiGet
    } as unknown as { get: (url: string) => Promise<{ data: WeeklyProgressResponse }> };

    renderWithProvider(mockClient);

    await waitFor(() => {
      expect(screen.getByTestId('journals')).toHaveTextContent('0');
    });

    expect(apiGet).not.toHaveBeenCalled();
  });
});
