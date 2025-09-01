import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

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
        // Redirect to login page
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }
  );

  return authenticatedApi;
};

// Helper function to get signed URL for Supabase Storage files
export const getSignedUrl = async (filePath: string, authenticatedApi: any): Promise<string> => {
  if (!filePath) return '';
  
  // If it's already a full URL (including Supabase signed URLs), return as-is
  if (filePath.startsWith('http')) {
    return filePath;
  }
  
  // Handle Supabase Storage paths that need signed URLs
  if (filePath.startsWith('/profiles/') || filePath.startsWith('/images/') || filePath.startsWith('/audio/')) {
    try {
      const pathParts = filePath.split('/').filter(p => p);
      if (pathParts.length >= 3) {
        const [bucketType, userId, ...filenameParts] = pathParts;
        const filename = filenameParts.join('/');
        
        const response = await authenticatedApi.get(`/files/${bucketType}/${userId}/${filename}`);
        return response.data.signedUrl;
      }
    } catch (error) {
      console.error('Error getting signed URL:', error);
      return '';
    }
  }
  
  return filePath;
};

// Helper function to get full file URL for audio/images (legacy support)
export const getFileUrl = (filePath: string) => {
  if (!filePath) return '';
  
  // If it's already a full URL, return as-is
  if (filePath.startsWith('http')) {
    return filePath;
  }
  
  // For Supabase Storage paths, we'll need to use getSignedUrl instead
  // This function now serves as legacy support for non-Supabase paths
  if (filePath.startsWith('/')) {
    const baseUrl = import.meta.env.VITE_API_URL || '';
    return `${baseUrl}${filePath}`;
  }
  
  // Return as-is for other cases
  return filePath;
};

export default api;