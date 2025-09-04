import React, { useState } from 'react';
import { useJobs } from '../contexts/JobContext';
import { useJobNotifications } from '../contexts/NotificationContext';

// Background job status indicator
export function BackgroundJobIndicator() {
  const { activeJobs, retryJob, deleteJob, isPolling } = useJobs();
  const { showJobCompletion, showJobError } = useJobNotifications();
  const [showDetails, setShowDetails] = useState(false);

  // Filter jobs by status
  const pendingJobs = activeJobs.filter(job => job.status === 'pending');
  const processingJobs = activeJobs.filter(job => job.status === 'processing');
  const completedJobs = activeJobs.filter(job => job.status === 'completed');
  const failedJobs = activeJobs.filter(job => job.status === 'failed');

  // Don't show indicator if no active jobs
  if (activeJobs.length === 0) {
    return null;
  }

  const getStatusIcon = () => {
    if (failedJobs.length > 0) return '⚠️';
    if (completedJobs.length > 0) return '✅';
    if (processingJobs.length > 0) return '🔄';
    if (pendingJobs.length > 0) return '⏳';
    return '📋';
  };

  const getStatusText = () => {
    const total = activeJobs.length;
    
    if (failedJobs.length > 0) {
      return `${failedJobs.length} meditation${failedJobs.length !== 1 ? 's' : ''} failed`;
    }
    
    if (completedJobs.length > 0) {
      return `${completedJobs.length} meditation${completedJobs.length !== 1 ? 's' : ''} ready`;
    }
    
    if (processingJobs.length > 0) {
      return `${processingJobs.length} meditation${processingJobs.length !== 1 ? 's' : ''} generating...`;
    }
    
    if (pendingJobs.length > 0) {
      return `${pendingJobs.length} meditation${pendingJobs.length !== 1 ? 's' : ''} queued`;
    }
    
    return `${total} meditation${total !== 1 ? 's' : ''} active`;
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      await retryJob(jobId);
    } catch (error) {
      console.error('Failed to retry job:', error);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    try {
      await deleteJob(jobId);
    } catch (error) {
      console.error('Failed to delete job:', error);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <>
      {/* Background job indicator banner */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-blue-600 text-white shadow-md">
        <div className="px-4 py-2 flex items-center justify-between">
          <div 
            className="flex items-center space-x-2 cursor-pointer flex-1"
            onClick={() => setShowDetails(!showDetails)}
          >
            <span className={`text-sm ${processingJobs.length > 0 ? 'animate-pulse' : ''}`}>
              {getStatusIcon()}
            </span>
            <span className="text-sm font-medium">
              {getStatusText()}
            </span>
            {isPolling && (
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            )}
          </div>
          
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-white hover:text-blue-200 text-sm"
          >
            {showDetails ? '▼' : '▶'}
          </button>
        </div>

        {/* Job details dropdown */}
        {showDetails && (
          <div className="bg-white text-gray-800 border-t border-blue-500 max-h-64 overflow-y-auto">
            <div className="p-4 space-y-3">
              {activeJobs.map(job => (
                <div key={job.jobId} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-sm">
                        {job.status === 'pending' && '⏳'}
                        {job.status === 'processing' && '🔄'}
                        {job.status === 'completed' && '✅'}
                        {job.status === 'failed' && '⚠️'}
                      </span>
                      <span className="font-medium text-sm">
                        {job.result?.title || `${job.reflectionType} Reflection`}
                      </span>
                      <span className="text-xs text-gray-500">
                        {job.duration}min
                      </span>
                    </div>
                    
                    <div className="text-xs text-gray-600">
                      {job.status === 'processing' && 'Generating meditation...'}
                      {job.status === 'pending' && 'Waiting to start...'}
                      {job.status === 'completed' && `Completed ${formatTimeAgo(job.completedAt!)}`}
                      {job.status === 'failed' && `Failed: ${job.error || 'Unknown error'}`}
                    </div>
                  </div>

                  <div className="flex space-x-2 ml-4">
                    {job.status === 'completed' && job.meditationId && (
                      <button
                        onClick={() => window.location.href = `/meditations/${job.meditationId}`}
                        className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                      >
                        ▶ Play
                      </button>
                    )}
                    
                    {job.status === 'failed' && (
                      <button
                        onClick={() => handleRetryJob(job.jobId)}
                        className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                      >
                        🔄 Retry
                      </button>
                    )}
                    
                    {(job.status === 'completed' || job.status === 'failed') && (
                      <button
                        onClick={() => handleDeleteJob(job.jobId)}
                        className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Spacer to push content down when indicator is showing */}
      <div className="h-12" />
    </>
  );
}

export default BackgroundJobIndicator;