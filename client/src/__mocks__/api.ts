import axios from 'axios';

// Mock API instance for testing
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Mock authenticated API hook
export const useAuthenticatedApi = () => {
  return api;
};

// Mock helper functions
export const getSignedUrl = async (filePath: string): Promise<string> => {
  return filePath;
};

export const getFileUrl = (filePath: string) => {
  return filePath;
};

export default api;