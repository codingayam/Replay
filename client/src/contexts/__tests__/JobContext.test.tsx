import React from 'react';
import { render, renderHook, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import { JobProvider, useJobs, JobCreationParams } from '../JobContext';
import * as api from '../../utils/api';

// Mock the API module
jest.mock('../../utils/api');
const mockApi = api.default as jest.Mocked<typeof api.default>;

// Mock the AuthContext
const mockGetToken = jest.fn();
jest.mock('../AuthContext', () => ({
  useAuth: () => ({
    getToken: mockGetToken,
  }),
}));

// Mock axios config
mockApi.request = jest.fn();

describe('JobContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetToken.mockResolvedValue('mock-jwt-token');
    
    // Setup console.log/error spies to reduce noise in tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock window.location.href
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const renderJobProvider = (children: React.ReactNode) => {
    return render(
      <JobProvider>
        {children}
      </JobProvider>
    );
  };

  const useJobsHook = () => {
    return renderHook(() => useJobs(), {
      wrapper: ({ children }) => <JobProvider>{children}</JobProvider>,
    });
  };

  describe('URL Construction Fixes', () => {
    it('should make requests without double /api prefix', async () => {
      const { result } = useJobsHook();
      
      mockApi.request.mockResolvedValueOnce({
        data: { jobId: 'test-job', status: 'pending', message: 'Job created' }
      });

      const jobParams: JobCreationParams = {
        noteIds: ['note1', 'note2'],
        duration: 300,
        reflectionType: 'Day'
      };

      await act(async () => {
        await result.current.createJob(jobParams);
      });

      // Verify the URL does NOT have double /api prefix
      expect(mockApi.request).toHaveBeenCalledWith({
        method: 'POST',
        url: '/meditate/jobs', // Should be this, NOT '/api/meditate/jobs'
        data: {
          noteIds: ['note1', 'note2'],
          duration: 300,
          reflectionType: 'Day',
          startDate: undefined,
          endDate: undefined
        },
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-jwt-token'
        }
      });
    });

    it('should make authenticated session recovery requests', async () => {
      // Mock session recovery response
      mockApi.request.mockResolvedValueOnce({
        data: { jobs: [] }
      });

      useJobsHook();

      // Wait for session recovery to complete
      await waitFor(() => {
        expect(mockApi.request).toHaveBeenCalledWith({
          method: 'GET',
          url: '/meditate/jobs?status=pending,processing',
          data: undefined,
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer mock-jwt-token'
          }
        });
      });
    });

    it('should include Bearer token in all requests', async () => {
      const { result } = useJobsHook();
      
      mockApi.request.mockResolvedValueOnce({
        data: { jobId: 'test-job', status: 'pending', message: 'Job created' }
      });

      await act(async () => {
        await result.current.createJob({
          noteIds: ['note1'],
          duration: 300,
          reflectionType: 'Day'
        });
      });

      const callArgs = mockApi.request.mock.calls[1]; // Skip session recovery call
      expect(callArgs[0].headers.Authorization).toBe('Bearer mock-jwt-token');
    });
  });

  describe('Job Management', () => {
    it('should create a job successfully', async () => {
      const { result } = useJobsHook();
      
      mockApi.request
        .mockResolvedValueOnce({ data: { jobs: [] } }) // Session recovery
        .mockResolvedValueOnce({ // createJob
          data: { jobId: 'new-job-123', status: 'pending', message: 'Job created' }
        })
        .mockResolvedValueOnce({ data: { jobs: [] } }); // refreshJobs

      const jobParams: JobCreationParams = {
        noteIds: ['note1', 'note2'],
        duration: 300,
        reflectionType: 'Day'
      };

      let jobResult;
      await act(async () => {
        jobResult = await result.current.createJob(jobParams);
      });

      expect(jobResult).toEqual({
        jobId: 'new-job-123',
        status: 'pending',
        message: 'Job created'
      });
    });

    it('should get job status', async () => {
      const { result } = useJobsHook();
      
      mockApi.request
        .mockResolvedValueOnce({ data: { jobs: [] } }) // Session recovery
        .mockResolvedValueOnce({ // getJobStatus
          data: {
            jobId: 'test-job',
            status: 'completed',
            reflectionType: 'Day',
            duration: 300,
            experienceCount: 2,
            createdAt: '2025-09-04T10:00:00Z',
            completedAt: '2025-09-04T10:05:00Z',
            meditationId: 'meditation-123'
          }
        });

      let jobStatus;
      await act(async () => {
        jobStatus = await result.current.getJobStatus('test-job');
      });

      expect(jobStatus).toEqual({
        jobId: 'test-job',
        status: 'completed',
        reflectionType: 'Day',
        duration: 300,
        experienceCount: 2,
        createdAt: '2025-09-04T10:00:00Z',
        completedAt: '2025-09-04T10:05:00Z',
        meditationId: 'meditation-123'
      });
    });

    it('should retry a failed job', async () => {
      const { result } = useJobsHook();
      
      mockApi.request
        .mockResolvedValueOnce({ data: { jobs: [] } }) // Session recovery
        .mockResolvedValueOnce({ // retryJob
          data: { jobId: 'retry-job', status: 'pending', message: 'Job retried' }
        })
        .mockResolvedValueOnce({ data: { jobs: [] } }); // refreshJobs

      let retryResult;
      await act(async () => {
        retryResult = await result.current.retryJob('retry-job');
      });

      expect(retryResult).toEqual({
        jobId: 'retry-job',
        status: 'pending',
        message: 'Job retried'
      });

      expect(mockApi.request).toHaveBeenCalledWith({
        method: 'POST',
        url: '/meditate/jobs/retry-job/retry',
        data: undefined,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-jwt-token'
        }
      });
    });

    it('should delete a job', async () => {
      const { result } = useJobsHook();
      
      // Set up some initial jobs
      act(() => {
        // Access the internal state via a test helper if needed
        // For now, we'll test the API call
      });

      mockApi.request
        .mockResolvedValueOnce({ data: { jobs: [] } }) // Session recovery
        .mockResolvedValueOnce({ data: {} }); // deleteJob

      await act(async () => {
        await result.current.deleteJob('delete-job');
      });

      expect(mockApi.request).toHaveBeenCalledWith({
        method: 'DELETE',
        url: '/meditate/jobs/delete-job',
        data: undefined,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-jwt-token'
        }
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication errors', async () => {
      const { result } = useJobsHook();
      
      const authError = {
        response: { status: 401, data: { error: 'Unauthorized' } }
      };
      
      mockApi.request
        .mockResolvedValueOnce({ data: { jobs: [] } }) // Session recovery
        .mockRejectedValueOnce(authError); // createJob fails

      await act(async () => {
        try {
          await result.current.createJob({
            noteIds: ['note1'],
            duration: 300,
            reflectionType: 'Day'
          });
        } catch (error: any) {
          expect(error.message).toBe('Unauthorized');
        }
      });

      expect(window.location.href).toBe('/login');
    });

    it('should handle network errors gracefully', async () => {
      const { result } = useJobsHook();
      
      const networkError = {
        response: { status: 500, data: { error: 'Internal Server Error' } }
      };
      
      mockApi.request
        .mockResolvedValueOnce({ data: { jobs: [] } }) // Session recovery
        .mockRejectedValueOnce(networkError); // createJob fails

      await act(async () => {
        try {
          await result.current.createJob({
            noteIds: ['note1'],
            duration: 300,
            reflectionType: 'Day'
          });
        } catch (error: any) {
          expect(error.message).toBe('Internal Server Error');
        }
      });
    });

    it('should handle missing token gracefully', async () => {
      mockGetToken.mockRejectedValueOnce(new Error('No token available'));
      
      const { result } = useJobsHook();

      await act(async () => {
        try {
          await result.current.createJob({
            noteIds: ['note1'],
            duration: 300,
            reflectionType: 'Day'
          });
        } catch (error: any) {
          expect(error).toBeDefined();
        }
      });
    });
  });

  describe('Session Recovery', () => {
    it('should start polling when active jobs are found', async () => {
      const mockJobs = [
        {
          jobId: 'active-job-1',
          status: 'pending' as const,
          reflectionType: 'Day',
          duration: 300,
          experienceCount: 2,
          createdAt: '2025-09-04T10:00:00Z'
        }
      ];

      mockApi.request.mockResolvedValueOnce({
        data: { jobs: mockJobs }
      });

      const { result } = useJobsHook();

      await waitFor(() => {
        expect(result.current.activeJobs).toEqual(mockJobs);
        expect(result.current.isPolling).toBe(true);
      });
    });

    it('should not start polling when no active jobs are found', async () => {
      mockApi.request.mockResolvedValueOnce({
        data: { jobs: [] }
      });

      const { result } = useJobsHook();

      await waitFor(() => {
        expect(result.current.activeJobs).toEqual([]);
        expect(result.current.isPolling).toBe(false);
      });
    });

    it('should handle session recovery errors gracefully', async () => {
      mockApi.request.mockRejectedValueOnce(new Error('Session recovery failed'));

      // Should not throw, just log error
      const { result } = useJobsHook();

      await waitFor(() => {
        expect(result.current.activeJobs).toEqual([]);
        expect(result.current.isPolling).toBe(false);
      });
    });
  });

  describe('Polling Behavior', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should start and stop polling correctly', async () => {
      const { result } = useJobsHook();
      
      mockApi.request
        .mockResolvedValueOnce({ data: { jobs: [] } }) // Session recovery
        .mockResolvedValue({ data: { jobs: [] } }); // Polling requests

      await act(async () => {
        result.current.startPolling();
      });

      expect(result.current.isPolling).toBe(true);

      // Fast-forward time to trigger polling
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await act(async () => {
        result.current.stopPolling();
      });

      expect(result.current.isPolling).toBe(false);
    });
  });
});