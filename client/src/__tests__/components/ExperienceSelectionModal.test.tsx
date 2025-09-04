import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ExperienceSelectionModal from '../../components/ExperienceSelectionModal';
import { useAuthenticatedApi } from '../../utils/api';
import type { Note } from '../../types';

// Mock the API hook
jest.mock('../../utils/api', () => ({
  useAuthenticatedApi: jest.fn(),
}));

const mockUseAuthenticatedApi = useAuthenticatedApi as jest.MockedFunction<typeof useAuthenticatedApi>;

describe('ExperienceSelectionModal - Ideas Filtering Feature', () => {
  const mockOnClose = jest.fn();
  const mockOnSelectExperiences = jest.fn();
  const mockCalculateRecommendedDuration = jest.fn(() => 5);
  const mockApiGet = jest.fn();

  const mockNotes: Note[] = [
    {
      id: '1',
      title: 'Creative App Idea',
      transcript: 'New app concept for productivity',
      category: ['ideas'],
      type: 'audio',
      date: '2025-09-01T10:00:00Z'
    },
    {
      id: '2',
      title: 'Business Model Sketch',
      transcript: 'Photo of business plan whiteboard',
      originalCaption: 'My business plan sketch',
      category: ['ideas'],
      type: 'photo',
      date: '2025-09-01T11:00:00Z'
    },
    {
      id: '3',
      title: 'Gratitude Moment',
      transcript: 'Feeling thankful for the day',
      category: ['feelings'],
      type: 'audio',
      date: '2025-09-01T12:00:00Z'
    },
    {
      id: '4',
      title: 'Mixed Categories Note',
      transcript: 'Note with both categories',
      category: ['ideas', 'feelings'],
      type: 'audio',
      date: '2025-09-01T13:00:00Z'
    }
  ];

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onSelectExperiences: mockOnSelectExperiences,
    startDate: '2025-09-01',
    endDate: '2025-09-01',
    calculateRecommendedDuration: mockCalculateRecommendedDuration,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuthenticatedApi.mockReturnValue({
      get: mockApiGet,
    } as any);

    // Default API response with all notes
    mockApiGet.mockResolvedValue({
      data: { notes: mockNotes }
    });
  });

  test('shows all notes for Day reflection type', async () => {
    render(<ExperienceSelectionModal {...defaultProps} reflectionType="Day" />);
    
    await waitFor(() => {
      expect(screen.getByText('Creative App Idea')).toBeInTheDocument();
      expect(screen.getByText('Business Model Sketch')).toBeInTheDocument();
      expect(screen.getByText('Gratitude Moment')).toBeInTheDocument();
      expect(screen.getByText('Mixed Categories Note')).toBeInTheDocument();
    });

    // Should show 4 available experiences
    expect(screen.getByText('Available: 4 experiences')).toBeInTheDocument();
  });

  test('shows all notes for Night reflection type', async () => {
    render(<ExperienceSelectionModal {...defaultProps} reflectionType="Night" />);
    
    await waitFor(() => {
      expect(screen.getByText('Creative App Idea')).toBeInTheDocument();
      expect(screen.getByText('Business Model Sketch')).toBeInTheDocument();
      expect(screen.getByText('Gratitude Moment')).toBeInTheDocument();
      expect(screen.getByText('Mixed Categories Note')).toBeInTheDocument();
    });

    // Should show 4 available experiences
    expect(screen.getByText('Available: 4 experiences')).toBeInTheDocument();
  });

  test('filters to ideas-only notes for Ideas reflection type', async () => {
    render(<ExperienceSelectionModal {...defaultProps} reflectionType="Ideas" />);
    
    await waitFor(() => {
      // Should show ideas-categorized notes
      expect(screen.getByText('Creative App Idea')).toBeInTheDocument();
      expect(screen.getByText('Business Model Sketch')).toBeInTheDocument();
      expect(screen.getByText('Mixed Categories Note')).toBeInTheDocument();
      
      // Should NOT show feelings-only notes
      expect(screen.queryByText('Gratitude Moment')).not.toBeInTheDocument();
    });

    // Should show 3 available experiences (filtered)
    expect(screen.getByText('Available: 3 experiences')).toBeInTheDocument();
  });

  test('shows Ideas-specific empty state when no ideas in date range', async () => {
    // Mock API to return only feelings notes
    mockApiGet.mockResolvedValue({
      data: { 
        notes: [mockNotes.find(note => note.category.includes('feelings'))!] 
      }
    });

    render(<ExperienceSelectionModal {...defaultProps} reflectionType="Ideas" />);
    
    await waitFor(() => {
      expect(screen.getByText('No ideas found')).toBeInTheDocument();
      expect(screen.getByText(/You don't have any ideas-categorized experiences/)).toBeInTheDocument();
      expect(screen.getByText(/Try selecting a different time period/)).toBeInTheDocument();
    });

    // Should show lightbulb emoji for Ideas empty state
    expect(screen.getByText('💡')).toBeInTheDocument();
  });

  test('shows general empty state for Day/Night types', async () => {
    // Mock API to return empty notes array
    mockApiGet.mockResolvedValue({
      data: { notes: [] }
    });

    render(<ExperienceSelectionModal {...defaultProps} reflectionType="Day" />);
    
    await waitFor(() => {
      expect(screen.getByText('No experiences found')).toBeInTheDocument();
      expect(screen.getByText(/You don't have any recorded experiences/)).toBeInTheDocument();
      expect(screen.queryByText(/ideas-categorized/)).not.toBeInTheDocument();
    });

    // Should show calendar emoji for general empty state
    expect(screen.getByText('📅')).toBeInTheDocument();
  });

  test('note selection functionality works with Ideas filtering', async () => {
    render(<ExperienceSelectionModal {...defaultProps} reflectionType="Ideas" />);
    
    await waitFor(() => {
      expect(screen.getByText('Creative App Idea')).toBeInTheDocument();
    });

    // Select the first ideas note
    const firstNoteCheckbox = screen.getAllByRole('button')[2]; // Skip close and title buttons
    fireEvent.click(firstNoteCheckbox);
    
    await waitFor(() => {
      expect(screen.getByText('(1)')).toBeInTheDocument(); // Selection count
    });

    // Click Generate Reflection button
    const generateButton = screen.getByText(/Generate Reflection/);
    fireEvent.click(generateButton);

    expect(mockOnSelectExperiences).toHaveBeenCalledWith(['1']); // Should pass the selected note ID
  });

  test('handles API loading state', () => {
    mockApiGet.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(<ExperienceSelectionModal {...defaultProps} reflectionType="Ideas" />);
    
    expect(screen.getByText('Loading your experiences...')).toBeInTheDocument();
    expect(screen.getByText('✨')).toBeInTheDocument(); // Loading spinner
  });

  test('handles API error state', async () => {
    mockApiGet.mockRejectedValue(new Error('API Error'));
    
    render(<ExperienceSelectionModal {...defaultProps} reflectionType="Ideas" />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load experiences. Please try again.')).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });
  });

  test('retry button works after API error', async () => {
    // First call fails, second call succeeds
    mockApiGet
      .mockRejectedValueOnce(new Error('API Error'))
      .mockResolvedValueOnce({ data: { notes: mockNotes } });
    
    render(<ExperienceSelectionModal {...defaultProps} reflectionType="Ideas" />);
    
    await waitFor(() => {
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    const retryButton = screen.getByText('Try Again');
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('Creative App Idea')).toBeInTheDocument();
    });

    expect(mockApiGet).toHaveBeenCalledTimes(2);
  });

  test('modal does not render when isOpen is false', () => {
    render(<ExperienceSelectionModal {...defaultProps} isOpen={false} />);
    
    expect(screen.queryByText('Select Experiences')).not.toBeInTheDocument();
  });

  test('modal close functionality works', async () => {
    render(<ExperienceSelectionModal {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Select Experiences')).toBeInTheDocument();
    });

    // Test close button
    const closeButton = document.querySelector('button svg.lucide-x')?.closest('button');
    fireEvent.click(closeButton!);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('shows correct experience count in title for Ideas filtering', async () => {
    render(<ExperienceSelectionModal {...defaultProps} reflectionType="Ideas" />);
    
    await waitFor(() => {
      expect(screen.getByText('Available: 3 experiences')).toBeInTheDocument();
    });
  });

  test('recommended duration updates based on selection count', async () => {
    mockCalculateRecommendedDuration.mockReturnValue(8);
    
    render(<ExperienceSelectionModal {...defaultProps} reflectionType="Ideas" />);
    
    await waitFor(() => {
      expect(screen.getByText('Creative App Idea')).toBeInTheDocument();
    });

    // Select an experience
    const firstNoteCheckbox = screen.getAllByRole('button')[2];
    fireEvent.click(firstNoteCheckbox);
    
    await waitFor(() => {
      expect(screen.getByText(/Recommended Duration: 8 minutes/)).toBeInTheDocument();
    });

    expect(mockCalculateRecommendedDuration).toHaveBeenCalledWith(1);
  });

  test('handles notes with mixed categories correctly', async () => {
    render(<ExperienceSelectionModal {...defaultProps} reflectionType="Ideas" />);
    
    await waitFor(() => {
      // Note with both 'ideas' and 'feelings' should appear in Ideas filtering
      expect(screen.getByText('Mixed Categories Note')).toBeInTheDocument();
    });
  });
});