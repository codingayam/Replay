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
  afterEach(() => {
    cleanup();
  });

  it('fetches and exposes weekly progress data', async () => {
    const apiGet = jest.fn();
    (apiGet as any).mockResolvedValue({
        data: {
          weekStart: '2025-05-19',
          timezone: 'America/New_York',
          thresholds: {
            unlockMeditations: 3,
            reportJournals: 5,
            reportMeditations: 2
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
            reportJournalRemaining: 1,
            reportMeditationRemaining: 1,
            nextReportDate: '2025-05-26'
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
    expect(screen.getByTestId('threshold')).toHaveTextContent('3');
    expect(apiGet).toHaveBeenCalledWith('/progress/week');
  });
});
