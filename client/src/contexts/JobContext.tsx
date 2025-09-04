import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import api from '../utils/api';
import { useAuth } from './AuthContext';
import { useJobNotifications } from './NotificationContext';

// Types for meditation jobs
export interface MeditationJob {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  reflectionType: string;
  duration: number;
  experienceCount: number;
  createdAt: string;
  completedAt?: string;
  meditationId?: string;
  error?: string;
  result?: {
    title: string;
    summary: string;
    playlist: any[];
  };
}

// Job creation parameters
export interface JobCreationParams {
  noteIds: string[];
  duration: number;
  reflectionType: string;
  startDate?: string;
  endDate?: string;
  title?: string;
  summary?: string;
}

// Context value interface
interface JobContextValue {
  activeJobs: MeditationJob[];
  isPolling: boolean;
  createJob: (params: JobCreationParams) => Promise<{ jobId: string; status: string; message: string }>;
  getJobStatus: (jobId: string) => Promise<MeditationJob>;
  retryJob: (jobId: string) => Promise<{ jobId: string; status: string; message: string }>;
  deleteJob: (jobId: string) => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
  refreshJobs: () => Promise<void>;
}

// Create context
const JobContext = createContext<JobContextValue | undefined>(undefined);

// Provider component
export function JobProvider({ children }: { children: ReactNode }) {
  const [activeJobs, setActiveJobs] = useState<MeditationJob[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const { getToken } = useAuth();
  const { showJobCompletion, showJobError } = useJobNotifications();
  
  // Track previous job statuses to detect changes
  const previousJobStatuses = useRef<Record<string, string>>({});

  // Helper to create authenticated API request
  const makeAuthenticatedRequest = useCallback(async (method: string, url: string, data?: any) => {
    try {
      const token = await getToken();
      const config = {
        method,
        url: url, // Remove /api prefix since api instance already has it in baseURL
        data,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` })
        }
      };

      const response = await api.request(config);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.error('Authentication failed - redirecting to login');
        window.location.href = '/login';
      }
      throw error;
    }
  }, [getToken]);

  // Create a new background meditation job
  const createJob = useCallback(async (params: JobCreationParams) => {
    try {
      console.log('🔄 Creating background meditation job...', params);
      
      const response = await makeAuthenticatedRequest('POST', '/meditate/jobs', {
        noteIds: params.noteIds,
        duration: params.duration,
        reflectionType: params.reflectionType,
        startDate: params.startDate,
        endDate: params.endDate
      });

      console.log('✅ Job created:', response);
      
      // Initialize status tracking for new job
      previousJobStatuses.current[response.jobId] = response.status || 'pending';
      
      // Refresh active jobs after creating new one
      await refreshJobs();
      
      // Start polling if not already polling
      if (!isPolling) {
        startPolling();
      }

      return {
        jobId: response.jobId,
        status: response.status,
        message: response.message
      };

    } catch (error: any) {
      console.error('❌ Failed to create job:', error);
      throw new Error(error.response?.data?.error || 'Failed to create background job');
    }
  }, [makeAuthenticatedRequest, isPolling]);

  // Get status of a specific job
  const getJobStatus = useCallback(async (jobId: string): Promise<MeditationJob> => {
    try {
      const response = await makeAuthenticatedRequest('GET', `/meditate/jobs/${jobId}`);
      return response as MeditationJob;
    } catch (error: any) {
      console.error(`❌ Failed to get job status for ${jobId}:`, error);
      throw new Error(error.response?.data?.error || 'Failed to get job status');
    }
  }, [makeAuthenticatedRequest]);

  // Retry a failed job
  const retryJob = useCallback(async (jobId: string) => {
    try {
      console.log(`🔄 Retrying job ${jobId}...`);
      
      const response = await makeAuthenticatedRequest('POST', `/meditate/jobs/${jobId}/retry`);
      
      // Refresh jobs after retry
      await refreshJobs();
      
      // Start polling if not already polling
      if (!isPolling) {
        startPolling();
      }

      return {
        jobId: response.jobId,
        status: response.status,
        message: response.message
      };

    } catch (error: any) {
      console.error(`❌ Failed to retry job ${jobId}:`, error);
      throw new Error(error.response?.data?.error || 'Failed to retry job');
    }
  }, [makeAuthenticatedRequest, isPolling]);

  // Delete/cancel a job
  const deleteJob = useCallback(async (jobId: string) => {
    try {
      console.log(`🗑️ Deleting job ${jobId}...`);
      
      await makeAuthenticatedRequest('DELETE', `/meditate/jobs/${jobId}`);
      
      // Remove job from local state
      setActiveJobs(prev => prev.filter(job => job.jobId !== jobId));
      
      console.log(`✅ Job ${jobId} deleted successfully`);

    } catch (error: any) {
      console.error(`❌ Failed to delete job ${jobId}:`, error);
      throw new Error(error.response?.data?.error || 'Failed to delete job');
    }
  }, [makeAuthenticatedRequest]);

  // Refresh active jobs from server
  const refreshJobs = useCallback(async () => {
    try {
      // Get active and recent jobs (pending, processing, completed in last hour)
      const response = await makeAuthenticatedRequest('GET', '/meditate/jobs?status=pending,processing,completed,failed');
      const { jobs } = response;

      // Check for status changes and trigger notifications
      if (jobs) {
        jobs.forEach((job: MeditationJob) => {
          const previousStatus = previousJobStatuses.current[job.jobId];
          
          // If status changed to completed or failed, show notification
          if (previousStatus && previousStatus !== job.status) {
            if (job.status === 'completed' && previousStatus === 'processing') {
              console.log('🎉 Job completed, showing notification:', job.jobId);
              showJobCompletion(job);
            } else if (job.status === 'failed' && previousStatus !== 'failed') {
              console.log('❌ Job failed, showing notification:', job.jobId);
              showJobError(job);
            }
          }
          
          // Update previous status tracking
          previousJobStatuses.current[job.jobId] = job.status;
        });
      }

      setActiveJobs(jobs || []);
      
      // If no active jobs, stop polling
      if (!jobs || jobs.length === 0 || !jobs.some((job: MeditationJob) => 
        job.status === 'pending' || job.status === 'processing'
      )) {
        stopPolling();
      }

    } catch (error: any) {
      console.error('❌ Failed to refresh jobs:', error);
      // Don't throw here to avoid breaking polling
    }
  }, [makeAuthenticatedRequest, showJobCompletion, showJobError]);

  // Start polling for job status updates
  const startPolling = useCallback(() => {
    if (isPolling) return;
    
    console.log('⚙️ Starting job status polling...');
    setIsPolling(true);

    // Initial refresh
    refreshJobs();

    // Set up interval
    const interval = setInterval(() => {
      refreshJobs();
    }, 5000); // Poll every 5 seconds

    setPollingInterval(interval);
  }, [isPolling, refreshJobs]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (!isPolling) return;
    
    console.log('⏹️ Stopping job status polling...');
    setIsPolling(false);

    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  }, [isPolling, pollingInterval]);

  // Session recovery - check for active jobs on mount
  useEffect(() => {
    const checkForActiveJobs = async () => {
      try {
        console.log('🔍 Checking for existing active jobs...');
        
        const response = await makeAuthenticatedRequest('GET', '/meditate/jobs?status=pending,processing');
        const { jobs } = response;

        if (jobs && jobs.length > 0) {
          console.log(`📋 Found ${jobs.length} active job(s), starting session recovery...`);
          
          // Initialize status tracking for existing jobs
          jobs.forEach((job: MeditationJob) => {
            previousJobStatuses.current[job.jobId] = job.status;
          });
          
          setActiveJobs(jobs);
          startPolling();
        } else {
          console.log('✅ No active jobs found');
        }

      } catch (error) {
        console.error('❌ Session recovery failed:', error);
        // Don't break the app if session recovery fails
      }
    };

    checkForActiveJobs();

    // Cleanup polling on unmount
    return () => {
      stopPolling();
    };
  }, [makeAuthenticatedRequest]); // Add makeAuthenticatedRequest to dependencies

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, []); // Remove pollingInterval dependency to prevent cleanup recreation

  const value: JobContextValue = {
    activeJobs,
    isPolling,
    createJob,
    getJobStatus,
    retryJob,
    deleteJob,
    startPolling,
    stopPolling,
    refreshJobs
  };

  return (
    <JobContext.Provider value={value}>
      {children}
    </JobContext.Provider>
  );
}

// Hook to use the job context
export function useJobs(): JobContextValue {
  const context = useContext(JobContext);
  if (context === undefined) {
    throw new Error('useJobs must be used within a JobProvider');
  }
  return context;
}

export default JobContext;