import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReflectionTypeModal from '../../components/ReflectionTypeModal';

describe('ReflectionTypeModal - Ideas Reflection Feature', () => {
  const mockOnClose = jest.fn();
  const mockOnSelectType = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onSelectType: mockOnSelectType,
  };

  test('renders all three reflection types', () => {
    render(<ReflectionTypeModal {...defaultProps} />);
    
    // Check for Day Meditation
    expect(screen.getByText('Day')).toBeInTheDocument();
    expect(screen.getByText('Morning mindfulness')).toBeInTheDocument();
    
    // Check for Night Meditation (renamed from Night Reflection)
    expect(screen.getByText('Night')).toBeInTheDocument();
    expect(screen.getByText('Evening review')).toBeInTheDocument();
    
    // Check for Ideas Reflection
    expect(screen.getByText('Ideas')).toBeInTheDocument();
    expect(screen.getByText('Creative inspiration')).toBeInTheDocument();
    
    // Verify both Day and Night show "Meditation", Ideas shows "Reflection"
    const meditationOptions = screen.getAllByText('Meditation');
    expect(meditationOptions).toHaveLength(2); // Day and Night
    expect(screen.getByText('Reflection')).toBeInTheDocument(); // Ideas
  });

  test('shows correct icons for each reflection type', () => {
    render(<ReflectionTypeModal {...defaultProps} />);
    
    // The icons are rendered as SVG elements through lucide-react
    // We can test for specific SVG classes
    expect(document.querySelector('.lucide-sun')).toBeInTheDocument();
    expect(document.querySelector('.lucide-moon')).toBeInTheDocument();
    expect(document.querySelector('.lucide-lightbulb')).toBeInTheDocument();
  });

  test('applies correct color themes', () => {
    render(<ReflectionTypeModal {...defaultProps} />);
    
    // Check for yellow theme (Day) - background color #fef3c7
    const dayIcon = screen.getByText('Day').closest('button');
    expect(dayIcon).toBeInTheDocument();
    
    // Check for purple theme (Night) - background color #ddd6fe  
    const nightIcon = screen.getByText('Night').closest('button');
    expect(nightIcon).toBeInTheDocument();
    
    // Check for purple theme (Ideas) - background color #f3e8ff
    const ideasIcon = screen.getByText('Ideas').closest('button');
    expect(ideasIcon).toBeInTheDocument();
  });

  test('calls onSelectType with "Day" when Day option clicked', () => {
    render(<ReflectionTypeModal {...defaultProps} />);
    
    const dayButton = screen.getByText('Day').closest('button');
    fireEvent.click(dayButton!);
    
    expect(mockOnSelectType).toHaveBeenCalledWith('Day');
    expect(mockOnSelectType).toHaveBeenCalledTimes(1);
  });

  test('calls onSelectType with "Night" when Night option clicked', () => {
    render(<ReflectionTypeModal {...defaultProps} />);
    
    const nightButton = screen.getByText('Night').closest('button');
    fireEvent.click(nightButton!);
    
    expect(mockOnSelectType).toHaveBeenCalledWith('Night');
    expect(mockOnSelectType).toHaveBeenCalledTimes(1);
  });

  test('calls onSelectType with "Ideas" when Ideas option clicked', () => {
    render(<ReflectionTypeModal {...defaultProps} />);
    
    const ideasButton = screen.getByText('Ideas').closest('button');
    fireEvent.click(ideasButton!);
    
    expect(mockOnSelectType).toHaveBeenCalledWith('Ideas');
    expect(mockOnSelectType).toHaveBeenCalledTimes(1);
  });

  test('modal close functionality works', () => {
    render(<ReflectionTypeModal {...defaultProps} />);
    
    // Test X button click - find button with X svg
    const closeButton = document.querySelector('button svg.lucide-x')?.closest('button');
    expect(closeButton).toBeInTheDocument();
    
    fireEvent.click(closeButton!);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('does not render when isOpen is false', () => {
    render(<ReflectionTypeModal {...defaultProps} isOpen={false} />);
    
    expect(screen.queryByText('Choose Your Reflection Type')).not.toBeInTheDocument();
    expect(screen.queryByText('Day')).not.toBeInTheDocument();
    expect(screen.queryByText('Night')).not.toBeInTheDocument();
    expect(screen.queryByText('Ideas')).not.toBeInTheDocument();
  });

  test('displays correct modal title', () => {
    render(<ReflectionTypeModal {...defaultProps} />);
    
    expect(screen.getByText('Choose Your Reflection Type')).toBeInTheDocument();
  });

  test('Night option displays "Meditation" instead of "Reflection"', () => {
    render(<ReflectionTypeModal {...defaultProps} />);
    
    const nightSection = screen.getByText('Night').closest('button');
    expect(nightSection).toHaveTextContent('Night');
    expect(nightSection).toHaveTextContent('Meditation');
    expect(nightSection).not.toHaveTextContent('Night Reflection');
  });

  test('Ideas option has distinct styling from Day/Night', () => {
    render(<ReflectionTypeModal {...defaultProps} />);
    
    const ideasButton = screen.getByText('Ideas').closest('button');
    const dayButton = screen.getByText('Day').closest('button');
    
    // Both should exist but Ideas should have "Reflection" while Day has "Meditation"
    expect(ideasButton).toHaveTextContent('Ideas');
    expect(ideasButton).toHaveTextContent('Reflection');
    expect(dayButton).toHaveTextContent('Day');
    expect(dayButton).toHaveTextContent('Meditation');
  });

  test('supports keyboard navigation', () => {
    render(<ReflectionTypeModal {...defaultProps} />);
    
    // Test button focus
    const dayButton = screen.getByText('Day').closest('button');
    expect(dayButton).toBeInTheDocument();
    
    // Focus and click should work
    dayButton?.focus();
    fireEvent.click(dayButton!);
    expect(mockOnSelectType).toHaveBeenCalledWith('Day');
  });

  test('Ideas option has creative inspiration description', () => {
    render(<ReflectionTypeModal {...defaultProps} />);
    
    expect(screen.getByText('Creative inspiration')).toBeInTheDocument();
    
    const ideasButton = screen.getByText('Ideas').closest('button');
    expect(ideasButton).toHaveTextContent('Creative inspiration');
  });
});