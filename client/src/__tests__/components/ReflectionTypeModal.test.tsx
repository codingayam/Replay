import { jest } from '@jest/globals';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ReflectionTypeModal from '../../components/ReflectionTypeModal';

describe('ReflectionTypeModal', () => {
  const handleClose = jest.fn();
  const handleSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderModal = (overrides: Partial<React.ComponentProps<typeof ReflectionTypeModal>> = {}) => {
    return render(
      <ReflectionTypeModal
        isOpen
        onClose={handleClose}
        onSelectType={handleSelect}
        {...overrides}
      />
    );
  };

  it('renders meditation option with expected copy', () => {
    renderModal();

    expect(screen.getByRole('heading', { name: 'Choose Your Reflection Type' })).toBeInTheDocument();

    expect(screen.getByRole('heading', { level: 3, name: 'Meditation' })).toBeInTheDocument();
    expect(screen.getByText('Guided mindfulness sessions')).toBeInTheDocument();
  });

  it('invokes onSelectType with "Meditation"', async () => {
    renderModal();

    const meditationButton = screen.getByRole('button', { name: /Meditation/i });

    await act(async () => {
      fireEvent.click(meditationButton);
    });
    expect(handleSelect).toHaveBeenCalledWith('Meditation');
  });

  it('closes when the overlay close button is clicked', () => {
    renderModal();

    const closeButton = screen.getByRole('button', { name: /close modal/i });
    fireEvent.click(closeButton);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('does not render when isOpen is false', () => {
    renderModal({ isOpen: false });

    expect(screen.queryByRole('heading', { name: 'Choose Your Reflection Type' })).not.toBeInTheDocument();
  });
});
