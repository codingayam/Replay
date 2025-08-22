import axios from 'axios';
import { useAuth } from '@clerk/clerk-react';

// Get API base URL from environment or use default
const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return `${import.meta.env.VITE_API_URL}/api`;
  }
  return '/api'; // Default for development
};

// Create axios instance
const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Custom hook to get authenticated axios instance
export const useAuthenticatedApi = () => {
  const { getToken } = useAuth();

  // Create an axios instance with authentication
  const authenticatedApi = axios.create({
    baseURL: getApiBaseUrl(),
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Add request interceptor to include auth token
  authenticatedApi.interceptors.request.use(
    async (config) => {
      try {
        const token = await getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch (error) {
        console.error('Failed to get auth token:', error);
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Add response interceptor for error handling
  authenticatedApi.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        console.error('Authentication failed - redirecting to login');
        // Clerk will handle the redirect automatically
      }
      return Promise.reject(error);
    }
  );

  return authenticatedApi;
};

// Helper function to get full file URL for audio/images
export const getFileUrl = (filePath: string) => {
  if (!filePath) return '';
  
  // If the path starts with /, it's a relative path that needs the backend URL
  if (filePath.startsWith('/')) {
    const baseUrl = import.meta.env.VITE_API_URL || '';
    return `${baseUrl}${filePath}`;
  }
  
  // If it's already a full URL, return as-is
  return filePath;
};

export default api;