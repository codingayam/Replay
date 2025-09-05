/**
 * JobContext Integration Test - Focused on URL Construction and Authentication
 * 
 * This test validates the fixes for:
 * 1. URL double-prefixing issue (was creating /api/api/meditate/jobs)
 * 2. Unauthenticated session recovery API calls
 */

import { act, renderHook } from '@testing-library/react';
import React from 'react';
import axios from 'axios';

// Mock axios before importing JobContext
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockAxiosInstance = {
  request: jest.fn(),
} as any;

// Mock API module by creating a manual mock
jest.mock('../../utils/api', () => {
  const mockApi = {
    request: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  };
  
  return {
    __esModule: true,
    default: mockApi,
    useAuthenticatedApi: () => mockApi,
  };
});

// Mock AuthContext
const mockGetToken = jest.fn();
jest.mock('../AuthContext', () => ({
  useAuth: () => ({
    getToken: mockGetToken,
  }),
}));

// Import after mocking
import { JobProvider, useJobs } from '../JobContext';
import api from '../../utils/api';

describe('JobContext - URL Construction and Authentication Fixes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetToken.mockResolvedValue('test-jwt-token');
    
    // Mock console methods to reduce noise
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });

    // Setup default API responses
    (api.request as jest.Mock).mockResolvedValue({ data: { jobs: [] } });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const renderJobsHook = () => {
    return renderHook(() => useJobs(), {
      wrapper: ({ children }) => <JobProvider>{children}</JobProvider>,
    });
  };

  describe('Critical Bug Fixes Validation', () => {
    it('should NOT double-prefix URLs with /api', async () => {
      const { result } = renderJobsHook();
      
      // Mock successful job creation response
      (api.request as jest.Mock).mockResolvedValueOnce({ 
        data: { jobs: [] } // Session recovery
      }).mockResolvedValueOnce({ 
        data: { jobId: 'test-job', status: 'pending', message: 'Created' } // Job creation
      }).mockResolvedValueOnce({ 
        data: { jobs: [] } // Refresh jobs
      });

      await act(async () => {
        await result.current.createJob({
          noteIds: ['note1'],
          duration: 300,
          reflectionType: 'Day'
        });
      });

      // Verify the createJob call (second call after session recovery)
      const createJobCall = (api.request as jest.Mock).mock.calls.find(call => 
        call[0].method === 'POST' && call[0].url.includes('meditate/jobs')
      );
      
      expect(createJobCall).toBeDefined();
      expect(createJobCall[0].url).toBe('/meditate/jobs');
      expect(createJobCall[0].url).not.toBe('/api/meditate/jobs'); // Should NOT have double prefix
    });

    it('should include Bearer token in all authenticated requests', async () => {
      const { result } = renderJobsHook();
      
      (api.request as jest.Mock).mockResolvedValue({ 
        data: { jobs: [] }
      });

      await act(async () => {
        await result.current.createJob({
          noteIds: ['note1'],
          duration: 300,
          reflectionType: 'Day'
        });
      });

      // Check that all API calls include the Authorization header
      const allCalls = (api.request as jest.Mock).mock.calls;
      
      allCalls.forEach((call, index) => {
        expect(call[0].headers).toHaveProperty('Authorization', 'Bearer test-jwt-token');
        console.log(`Call ${index}: ${call[0].method} ${call[0].url} - Auth: ${call[0].headers.Authorization}`);
      });
    });

    it('should use authenticated requests for session recovery', async () => {
      (api.request as jest.Mock).mockResolvedValue({ 
        data: { jobs: [] }
      });

      renderJobsHook();

      // Wait for session recovery to complete
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Verify session recovery call includes authentication
      const sessionRecoveryCall = (api.request as jest.Mock).mock.calls.find(call => 
        call[0].method === 'GET' && call[0].url.includes('status=pending,processing')
      );
      
      expect(sessionRecoveryCall).toBeDefined();
      expect(sessionRecoveryCall[0].headers.Authorization).toBe('Bearer test-jwt-token');
      expect(sessionRecoveryCall[0].url).toBe('/meditate/jobs?status=pending,processing');
    });

    it('should handle authentication failures correctly', async () => {
      const { result } = renderJobsHook();
      
      // Mock session recovery success, then job creation auth failure
      (api.request as jest.Mock)
        .mockResolvedValueOnce({ data: { jobs: [] } }) // Session recovery success
        .mockRejectedValueOnce({ // Job creation auth failure
          response: { 
            status: 401, 
            data: { error: 'Unauthorized' } 
          }
        });

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

      // Should redirect to login on 401
      expect(window.location.href).toBe('/login');
    });

    it('should make correct API calls for all job operations', async () => {
      const { result } = renderJobsHook();
      
      (api.request as jest.Mock).mockResolvedValue({ 
        data: { jobId: 'test', status: 'pending', jobs: [] }
      });

      await act(async () => {
        // Test various operations
        await result.current.getJobStatus('job-123');
        await result.current.retryJob('job-456');
        await result.current.deleteJob('job-789');
      });

      const calls = (api.request as jest.Mock).mock.calls;
      
      // Find specific operation calls
      const statusCall = calls.find(call => 
        call[0].method === 'GET' && call[0].url === '/meditate/jobs/job-123'
      );
      const retryCall = calls.find(call => 
        call[0].method === 'POST' && call[0].url === '/meditate/jobs/job-456/retry'
      );
      const deleteCall = calls.find(call => 
        call[0].method === 'DELETE' && call[0].url === '/meditate/jobs/job-789'
      );

      expect(statusCall).toBeDefined();
      expect(retryCall).toBeDefined();
      expect(deleteCall).toBeDefined();

      // All should have authentication
      expect(statusCall[0].headers.Authorization).toBe('Bearer test-jwt-token');
      expect(retryCall[0].headers.Authorization).toBe('Bearer test-jwt-token');
      expect(deleteCall[0].headers.Authorization).toBe('Bearer test-jwt-token');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing token gracefully', async () => {
      mockGetToken.mockRejectedValueOnce(new Error('No token'));
      
      const { result } = renderJobsHook();

      await act(async () => {
        try {
          await result.current.createJob({
            noteIds: ['note1'],
            duration: 300,
            reflectionType: 'Day'
          });
        } catch (error) {
          expect(error).toBeDefined();
        }
      });
    });

    it('should handle network errors without breaking', async () => {
      const { result } = renderJobsHook();
      
      (api.request as jest.Mock)
        .mockResolvedValueOnce({ data: { jobs: [] } }) // Session recovery
        .mockRejectedValueOnce(new Error('Network Error')); // Job creation failure

      await act(async () => {
        try {
          await result.current.createJob({
            noteIds: ['note1'],
            duration: 300,
            reflectionType: 'Day'
          });
        } catch (error: any) {
          expect(error.message).toContain('Failed to create background job');
        }
      });
    });
  });
});