import { jest } from '@jest/globals';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
jest.mock('axios');
import type { Note } from '../../types';

const axiosMock = axios as unknown as {
  create: jest.Mock;
  get: jest.Mock;
  request: jest.Mock;
};

let ExperienceSelectionModal: typeof import('../../components/ExperienceSelectionModal').default;

beforeAll(async () => {
  axiosMock.get.mockClear();
  ({ default: ExperienceSelectionModal } = await import('../../components/ExperienceSelectionModal'));
});

describe('ExperienceSelectionModal', () => {
  const notes: Note[] = [
    {
      id: '1',
      title: 'Creative App Idea',
      transcript: 'New app concept for productivity',
      category: ['ideas'],
      type: 'audio',
      date: '2025-09-01T10:00:00Z',
    },
    {
      id: '2',
      title: 'Gratitude Moment',
      transcript: 'Feeling thankful for the day',
      category: ['feelings'],
      type: 'audio',
      date: '2025-09-01T12:00:00Z',
    },
  ];

  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onSelectExperiences: jest.fn(),
    startDate: '2025-09-01',
    endDate: '2025-09-01',
    reflectionType: 'Ideas' as const,
    calculateRecommendedDuration: jest.fn(() => 5),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    axiosMock.get.mockResolvedValue({ data: { notes } });
  });

  it('filters notes for ideas reflections', async () => {
    render(<ExperienceSelectionModal {...defaultProps} />);

    await waitFor(() => expect(axiosMock.get).toHaveBeenCalled());

    expect(screen.getByText('Creative App Idea')).toBeInTheDocument();
    expect(screen.queryByText('Gratitude Moment')).not.toBeInTheDocument();
  });

  it('submits selected notes', async () => {
    const handleSelect = jest.fn();
    render(
      <ExperienceSelectionModal
        {...defaultProps}
        onSelectExperiences={handleSelect}
      />
    );

    await waitFor(() => expect(axiosMock.get).toHaveBeenCalled());

    fireEvent.click(screen.getByLabelText(/Creative App Idea/i));
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    expect(handleSelect).toHaveBeenCalledWith(expect.arrayContaining(['1']));
  });
});
