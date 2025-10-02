import axios, { AxiosHeaders } from 'axios';
import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const importMetaEnv =
  (typeof import.meta !== 'undefined' && (import.meta as any).env) ||
  (globalThis as any).__REPLAY_IMPORT_META_ENV__ ||
  {};

const isTestEnv = process.env.NODE_ENV === 'test';
const testApiClient = isTestEnv ? (globalThis as any).__REPLAY_TEST_API_CLIENT__ : undefined;

const resolveEnvValue = (key: string, fallback?: string) => {
  return importMetaEnv[key] ?? process.env[key] ?? fallback;
};

const getStoredOneSignalSubscriptionId = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage.getItem('onesignal_subscription_id');
  } catch (error) {
    console.warn('[OneSignal] Failed to read subscription id:', error);
    return null;
  }
};

// Get API base URL from environment or use default
const getApiBaseUrl = () => {
  const base = resolveEnvValue('VITE_API_URL', '');
  if (base) {
    return `${base}/api`;
  }
  return '/api'; // Default for development
};

// Create axios instance
const api = (testApiClient as any) ?? axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

let redirectingToLogin = false;

const handleUnauthorizedResponse = async () => {
  if (typeof window === 'undefined' || redirectingToLogin) {
    return;
  }

  redirectingToLogin = true;

  try {
    await supabase.auth.signOut();
  } catch (signOutError) {
    console.error('Failed to sign out after unauthorized response:', signOutError);
  }

  window.location.replace('/login');
};

api.interceptors.request.use((config) => {
  const subscriptionId = getStoredOneSignalSubscriptionId();
  if (subscriptionId) {
    const headers = ensureHeaders(config);
    headers.set('X-OneSignal-Subscription-Id', subscriptionId);
  } else if (config.headers) {
    const headers = ensureHeaders(config);
    headers.delete('X-OneSignal-Subscription-Id');
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      console.error('Authentication failed - redirecting to login');
      await handleUnauthorizedResponse();
    }
    return Promise.reject(error);
  }
);

if (isTestEnv) {
  (globalThis as any).__REPLAY_TEST_API_CLIENT__ = api;
}

// Custom hook to get authenticated axios instance
export const useAuthenticatedApi = () => {
  const { getToken } = useAuth();

  // Memoise the axios instance so components don't trigger
  // new effects on every render (prevents image flicker loops).
  const authenticatedApi = useMemo(() => {
    if (isTestEnv) {
      const testClient = (globalThis as any).__REPLAY_TEST_API_CLIENT__;
      if (testClient) {
        return testClient;
      }
    }

    const instance = axios.create({
      baseURL: getApiBaseUrl(),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    instance.interceptors.request.use(
      async (config) => {
        try {
          const token = await getToken();
          if (token) {
            const headers = ensureHeaders(config);
            headers.set('Authorization', `Bearer ${token}`);
          }
        } catch (error) {
          console.error('Failed to get auth token:', error);
        }

        const subscriptionId = getStoredOneSignalSubscriptionId();
        if (subscriptionId) {
          const headers = ensureHeaders(config);
          headers.set('X-OneSignal-Subscription-Id', subscriptionId);
        } else if (config.headers) {
          const headers = ensureHeaders(config);
          headers.delete('X-OneSignal-Subscription-Id');
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    instance.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          console.error('Authentication failed - redirecting to login');
          await handleUnauthorizedResponse();
        }
        return Promise.reject(error);
      }
    );

    return instance;
  }, [getToken]);

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
    const baseUrl = resolveEnvValue('VITE_API_URL', '');
    return `${baseUrl}${filePath}`;
  }
  
  // Return as-is for other cases
  return filePath;
};

export default api;

function ensureHeaders(config: { headers?: any }) {
  if (config.headers instanceof AxiosHeaders) {
    return config.headers;
  }

  const headers = new AxiosHeaders(config.headers as any);
  config.headers = headers;
  return headers;
}
