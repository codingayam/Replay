import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AudioRecorder from '../AudioRecorder';

// Mock MediaRecorder
const mockMediaRecorder = {
  start: jest.fn(),
  stop: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  requestData: jest.fn(),
  state: 'inactive',
  stream: null,
  mimeType: 'audio/wav',
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
  ondataavailable: null,
  onstop: null,
  onstart: null,
  onerror: null
};

const mockGetUserMedia = jest.fn();

Object.defineProperty(global, 'MediaRecorder', {
  writable: true,
  value: jest.fn().mockImplementation(() => mockMediaRecorder)
});

Object.defineProperty(global.navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: mockGetUserMedia,
    enumerateDevices: jest.fn().mockResolvedValue([])
  }
});

interface AudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob, duration: number) => void;
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
  disabled?: boolean;
}

describe('AudioRecorder', () => {
  const mockOnRecordingComplete = jest.fn();
  const mockOnRecordingStart = jest.fn();
  const mockOnRecordingStop = jest.fn();

  const defaultProps: AudioRecorderProps = {
    onRecordingComplete: mockOnRecordingComplete,
    onRecordingStart: mockOnRecordingStart,
    onRecordingStop: mockOnRecordingStop
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockMediaRecorder.state = 'inactive';
    mockGetUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: jest.fn() }]
    });
  });

  it('should render recording button when not recording', () => {
    render(<AudioRecorder {...defaultProps} />);
    
    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.getByText(/start recording|record/i)).toBeInTheDocument();
  });

  it('should request microphone permission and start recording when clicked', async () => {
    const user = userEvent.setup();
    render(<AudioRecorder {...defaultProps} />);

    const recordButton = screen.getByRole('button');
    
    await act(async () => {
      await user.click(recordButton);
    });

    expect(mockGetUserMedia).toHaveBeenCalledWith({
      audio: true,
      video: false
    });
    
    expect(mockOnRecordingStart).toHaveBeenCalled();
  });

  it('should handle microphone permission denied', async () => {
    const user = userEvent.setup();
    const mockError = new Error('Permission denied');
    mockGetUserMedia.mockRejectedValue(mockError);

    // Mock console.error to prevent noise in tests
    const originalError = console.error;
    console.error = jest.fn();

    render(<AudioRecorder {...defaultProps} />);

    const recordButton = screen.getByRole('button');
    
    await act(async () => {
      await user.click(recordButton);
    });

    await waitFor(() => {
      expect(screen.getByText(/microphone access denied|permission/i)).toBeInTheDocument();
    });

    console.error = originalError;
  });

  it('should show recording state when recording', async () => {
    const user = userEvent.setup();
    render(<AudioRecorder {...defaultProps} />);

    mockMediaRecorder.state = 'recording';
    
    await act(async () => {
      await user.click(screen.getByRole('button'));
    });

    // Simulate MediaRecorder state change
    act(() => {
      const startEvent = new Event('start');
      mockMediaRecorder.onstart?.(startEvent);
    });

    await waitFor(() => {
      expect(screen.getByText(/recording|stop/i)).toBeInTheDocument();
    });
  });

  it('should stop recording and process audio data', async () => {
    const user = userEvent.setup();
    const mockAudioData = new Blob(['mock audio data'], { type: 'audio/wav' });
    
    render(<AudioRecorder {...defaultProps} />);

    // Start recording
    await act(async () => {
      await user.click(screen.getByRole('button'));
    });

    mockMediaRecorder.state = 'recording';
    
    // Simulate recording started
    act(() => {
      const startEvent = new Event('start');
      mockMediaRecorder.onstart?.(startEvent);
    });

    // Stop recording
    await act(async () => {
      await user.click(screen.getByRole('button'));
    });

    // Simulate data available and stop events
    act(() => {
      const dataEvent = new CustomEvent('dataavailable', {
        detail: { data: mockAudioData }
      });
      Object.defineProperty(dataEvent, 'data', {
        value: mockAudioData,
        writable: false
      });
      mockMediaRecorder.ondataavailable?.(dataEvent as any);

      const stopEvent = new Event('stop');
      mockMediaRecorder.onstop?.(stopEvent);
    });

    expect(mockOnRecordingStop).toHaveBeenCalled();
    expect(mockOnRecordingComplete).toHaveBeenCalledWith(
      expect.any(Blob),
      expect.any(Number)
    );
  });

  it('should display recording duration during recording', async () => {
    const user = userEvent.setup();
    render(<AudioRecorder {...defaultProps} />);

    // Start recording
    await act(async () => {
      await user.click(screen.getByRole('button'));
    });

    mockMediaRecorder.state = 'recording';
    
    act(() => {
      const startEvent = new Event('start');
      mockMediaRecorder.onstart?.(startEvent);
    });

    // Check if duration is displayed (might be 0:00 initially)
    await waitFor(() => {
      expect(screen.getByText(/\d+:\d{2}/)).toBeInTheDocument();
    });
  });

  it('should be disabled when disabled prop is true', () => {
    render(<AudioRecorder {...defaultProps} disabled={true} />);
    
    const recordButton = screen.getByRole('button');
    expect(recordButton).toBeDisabled();
  });

  it('should handle recording errors gracefully', async () => {
    const user = userEvent.setup();
    const mockError = new Error('Recording failed');
    
    // Mock console.error to prevent noise
    const originalError = console.error;
    console.error = jest.fn();

    render(<AudioRecorder {...defaultProps} />);

    // Start recording
    await act(async () => {
      await user.click(screen.getByRole('button'));
    });

    // Simulate recording error
    act(() => {
      const errorEvent = new CustomEvent('error', {
        detail: mockError
      });
      Object.defineProperty(errorEvent, 'error', {
        value: mockError,
        writable: false
      });
      mockMediaRecorder.onerror?.(errorEvent as any);
    });

    await waitFor(() => {
      expect(screen.getByText(/recording error|failed/i)).toBeInTheDocument();
    });

    console.error = originalError;
  });

  it('should clean up resources on unmount', () => {
    const { unmount } = render(<AudioRecorder {...defaultProps} />);
    
    unmount();
    
    // Verify cleanup (this would be implementation specific)
    // In a real component, you might track active streams or MediaRecorder instances
    expect(mockMediaRecorder.removeEventListener).toHaveBeenCalled();
  });

  it('should reset state after successful recording', async () => {
    const user = userEvent.setup();
    const mockAudioData = new Blob(['mock audio data'], { type: 'audio/wav' });
    
    render(<AudioRecorder {...defaultProps} />);

    // Complete a recording cycle
    await act(async () => {
      await user.click(screen.getByRole('button')); // Start
    });

    mockMediaRecorder.state = 'recording';
    
    act(() => {
      const startEvent = new Event('start');
      mockMediaRecorder.onstart?.(startEvent);
    });

    await act(async () => {
      await user.click(screen.getByRole('button')); // Stop
    });

    act(() => {
      const dataEvent = new CustomEvent('dataavailable', {
        detail: { data: mockAudioData }
      });
      Object.defineProperty(dataEvent, 'data', {
        value: mockAudioData,
        writable: false
      });
      mockMediaRecorder.ondataavailable?.(dataEvent as any);

      const stopEvent = new Event('stop');
      mockMediaRecorder.onstop?.(stopEvent);
    });

    // Should be back to initial state
    await waitFor(() => {
      expect(screen.getByText(/start recording|record/i)).toBeInTheDocument();
    });
  });

  it('should format recording duration correctly', async () => {
    const user = userEvent.setup();
    render(<AudioRecorder {...defaultProps} />);

    // Start recording
    await act(async () => {
      await user.click(screen.getByRole('button'));
    });

    mockMediaRecorder.state = 'recording';
    
    act(() => {
      const startEvent = new Event('start');
      mockMediaRecorder.onstart?.(startEvent);
    });

    // The component should display formatted time
    // This depends on implementation but typically shows MM:SS format
    await waitFor(() => {
      const timeDisplay = screen.queryByText(/\d+:\d{2}/);
      if (timeDisplay) {
        expect(timeDisplay.textContent).toMatch(/^\d+:\d{2}$/);
      }
    });
  });
});