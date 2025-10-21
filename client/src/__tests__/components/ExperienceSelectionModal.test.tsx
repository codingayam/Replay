import { jest } from '@jest/globals';
import type { MockedFunction } from 'jest-mock';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { Note } from '../../types';

type ApiGetResponse = { data: { notes: Note[] } };

const apiGetMock = jest.fn() as MockedFunction<(endpoint: string) => Promise<ApiGetResponse>>;

let ExperienceSelectionModal: typeof import('../../components/ExperienceSelectionModal').default;

beforeAll(async () => {
  ({ default: ExperienceSelectionModal } = await import('../../components/ExperienceSelectionModal'));
});

describe('ExperienceSelectionModal', () => {
  const notes: Note[] = [
    {
      id: '1',
      title: 'Creative App Idea',
      transcript: 'New app concept for productivity',
      type: 'audio',
      date: '2025-09-01T10:00:00Z',
      audioUrl: 'https://example.com/audio-1.mp3',
    },
    {
      id: '2',
      title: 'Gratitude Moment',
      transcript: 'Feeling thankful for the day',
      type: 'text',
      date: '2025-09-01T12:00:00Z',
    },
  ];

  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onSelectExperiences: jest.fn(),
    startDate: '2025-09-01',
    endDate: '2025-09-01',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    apiGetMock.mockReset();
    apiGetMock.mockResolvedValue({ data: { notes } });
    (globalThis as any).__REPLAY_TEST_API_CLIENT__ = {
      get: apiGetMock,
    };
  });

  afterEach(() => {
    apiGetMock.mockReset();
    delete (globalThis as any).__REPLAY_TEST_API_CLIENT__;
  });

  it('renders notes returned by the API', async () => {
    render(<ExperienceSelectionModal {...defaultProps} />);

    await waitFor(() => expect(apiGetMock).toHaveBeenCalled());

    expect(screen.getByText('Creative App Idea')).toBeInTheDocument();
    expect(screen.getByText('Gratitude Moment')).toBeInTheDocument();
  });

  it('submits selected notes', async () => {
    const handleSelect = jest.fn();
    render(
      <ExperienceSelectionModal
        {...defaultProps}
        onSelectExperiences={handleSelect}
      />
    );

    await waitFor(() => expect(apiGetMock).toHaveBeenCalled());

    fireEvent.click(screen.getByText('Creative App Idea'));
    fireEvent.click(screen.getByRole('button', { name: /Generate Reflection/i }));

    expect(handleSelect).toHaveBeenCalledWith(expect.arrayContaining(['1']));
  });
});
