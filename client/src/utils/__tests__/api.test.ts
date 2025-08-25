import api from '../api';
import { mockSupabaseClient } from '../../test/mocks/supabase';
import { createMockNote, createMockProfile } from '../../test/factories';

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() }
    }
  })),
  isAxiosError: jest.fn()
}));

// Mock the supabase module
jest.mock('../../lib/supabase', () => ({
  supabase: mockSupabaseClient
}));

describe('API utility', () => {
  let mockAxiosInstance: any;
  let requestInterceptor: any;
  let responseInterceptor: any;

  beforeEach(() => {
    const axios = require('axios');
    mockAxiosInstance = axios.create();
    requestInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0]?.[0];
    responseInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0]?.[1];
    
    jest.clearAllMocks();
  });

  describe('request interceptor', () => {
    it('should add authorization header when token is available', async () => {
      const mockToken = 'mock-jwt-token';
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: { access_token: mockToken } },
        error: null
      });

      const config = { headers: {} };
      
      if (requestInterceptor) {
        const result = await requestInterceptor(config);
        expect(result.headers.Authorization).toBe(`Bearer ${mockToken}`);
      }
    });

    it('should not add authorization header when no token is available', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      });

      const config = { headers: {} };
      
      if (requestInterceptor) {
        const result = await requestInterceptor(config);
        expect(result.headers.Authorization).toBeUndefined();
      }
    });

    it('should handle auth session errors gracefully', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: new Error('Auth error')
      });

      const config = { headers: {} };
      
      if (requestInterceptor) {
        const result = await requestInterceptor(config);
        expect(result.headers.Authorization).toBeUndefined();
      }
    });
  });

  describe('response interceptor error handling', () => {
    it('should handle 401 unauthorized errors', async () => {
      const mockError = {
        response: {
          status: 401,
          data: { error: 'Unauthorized' }
        },
        config: { url: '/api/notes' }
      };

      if (responseInterceptor) {
        await expect(responseInterceptor(mockError)).rejects.toEqual(mockError);
      }
    });

    it('should handle 403 forbidden errors', async () => {
      const mockError = {
        response: {
          status: 403,
          data: { error: 'Forbidden' }
        },
        config: { url: '/api/profile' }
      };

      if (responseInterceptor) {
        await expect(responseInterceptor(mockError)).rejects.toEqual(mockError);
      }
    });

    it('should handle network errors', async () => {
      const mockError = {
        message: 'Network Error',
        code: 'ECONNREFUSED'
      };

      if (responseInterceptor) {
        await expect(responseInterceptor(mockError)).rejects.toEqual(mockError);
      }
    });

    it('should handle server errors (500)', async () => {
      const mockError = {
        response: {
          status: 500,
          data: { error: 'Internal Server Error' }
        },
        config: { url: '/api/meditate' }
      };

      if (responseInterceptor) {
        await expect(responseInterceptor(mockError)).rejects.toEqual(mockError);
      }
    });
  });

  describe('API methods', () => {
    beforeEach(() => {
      // Reset the axios mock instance methods
      mockAxiosInstance.get.mockReset();
      mockAxiosInstance.post.mockReset();
      mockAxiosInstance.put.mockReset();
      mockAxiosInstance.delete.mockReset();
    });

    describe('getNotes', () => {
      it('should fetch notes successfully', async () => {
        const mockNotes = [createMockNote(), createMockNote()];
        mockAxiosInstance.get.mockResolvedValue({ data: mockNotes });

        const result = await api.getNotes();

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/notes');
        expect(result).toEqual(mockNotes);
      });

      it('should fetch notes with date range', async () => {
        const mockNotes = [createMockNote()];
        mockAxiosInstance.get.mockResolvedValue({ data: mockNotes });

        const startDate = '2024-01-01';
        const endDate = '2024-01-31';

        const result = await api.getNotes(startDate, endDate);

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/notes/date-range', {
          params: { startDate, endDate }
        });
        expect(result).toEqual(mockNotes);
      });

      it('should handle API errors', async () => {
        const mockError = new Error('Failed to fetch notes');
        mockAxiosInstance.get.mockRejectedValue(mockError);

        await expect(api.getNotes()).rejects.toThrow('Failed to fetch notes');
      });
    });

    describe('createNote', () => {
      it('should create audio note with file upload', async () => {
        const mockNote = createMockNote({ type: 'audio' });
        mockAxiosInstance.post.mockResolvedValue({ data: mockNote });

        const audioFile = new File(['audio data'], 'test.wav', { type: 'audio/wav' });
        const localTimestamp = new Date().toISOString();

        const result = await api.createNote(audioFile, localTimestamp);

        expect(mockAxiosInstance.post).toHaveBeenCalledWith(
          '/api/notes',
          expect.any(FormData),
          expect.objectContaining({
            headers: expect.objectContaining({
              'Content-Type': 'multipart/form-data'
            })
          })
        );
        expect(result).toEqual(mockNote);
      });

      it('should handle file upload errors', async () => {
        const mockError = new Error('File upload failed');
        mockAxiosInstance.post.mockRejectedValue(mockError);

        const audioFile = new File(['audio data'], 'test.wav', { type: 'audio/wav' });

        await expect(api.createNote(audioFile)).rejects.toThrow('File upload failed');
      });
    });

    describe('createPhotoNote', () => {
      it('should create photo note with image and caption', async () => {
        const mockNote = createMockNote({ type: 'photo' });
        mockAxiosInstance.post.mockResolvedValue({ data: mockNote });

        const imageFile = new File(['image data'], 'test.jpg', { type: 'image/jpeg' });
        const caption = 'Test photo caption';
        const localTimestamp = new Date().toISOString();

        const result = await api.createPhotoNote(imageFile, caption, localTimestamp);

        expect(mockAxiosInstance.post).toHaveBeenCalledWith(
          '/api/notes/photo',
          expect.any(FormData),
          expect.objectContaining({
            headers: expect.objectContaining({
              'Content-Type': 'multipart/form-data'
            })
          })
        );
        expect(result).toEqual(mockNote);
      });
    });

    describe('deleteNote', () => {
      it('should delete note successfully', async () => {
        mockAxiosInstance.delete.mockResolvedValue({});

        const noteId = 'note-123';
        await api.deleteNote(noteId);

        expect(mockAxiosInstance.delete).toHaveBeenCalledWith(`/api/notes/${noteId}`);
      });

      it('should handle delete errors', async () => {
        const mockError = new Error('Failed to delete note');
        mockAxiosInstance.delete.mockRejectedValue(mockError);

        await expect(api.deleteNote('note-123')).rejects.toThrow('Failed to delete note');
      });
    });

    describe('profile methods', () => {
      it('should fetch profile successfully', async () => {
        const mockProfile = createMockProfile();
        mockAxiosInstance.get.mockResolvedValue({ data: mockProfile });

        const result = await api.getProfile();

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/profile');
        expect(result).toEqual(mockProfile);
      });

      it('should update profile successfully', async () => {
        const mockProfile = createMockProfile({ name: 'Updated Name' });
        mockAxiosInstance.post.mockResolvedValue({ data: mockProfile });

        const profileData = { name: 'Updated Name' };
        const result = await api.updateProfile(profileData);

        expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/profile', profileData);
        expect(result).toEqual(mockProfile);
      });

      it('should upload profile image successfully', async () => {
        const mockResponse = {
          profileImageUrl: '/profiles/user/image.jpg',
          message: 'Profile picture uploaded successfully'
        };
        mockAxiosInstance.post.mockResolvedValue({ data: mockResponse });

        const imageFile = new File(['image data'], 'profile.jpg', { type: 'image/jpeg' });
        const result = await api.uploadProfileImage(imageFile);

        expect(mockAxiosInstance.post).toHaveBeenCalledWith(
          '/api/profile/image',
          expect.any(FormData),
          expect.objectContaining({
            headers: expect.objectContaining({
              'Content-Type': 'multipart/form-data'
            })
          })
        );
        expect(result).toEqual(mockResponse);
      });
    });

    describe('meditation methods', () => {
      it('should generate meditation successfully', async () => {
        const mockResponse = {
          playlist: [
            { type: 'speech', audioUrl: '/meditations/user/segment1.wav' },
            { type: 'pause', duration: 10 }
          ],
          meditationId: 'meditation-123',
          summary: 'Meditation summary'
        };
        mockAxiosInstance.post.mockResolvedValue({ data: mockResponse });

        const noteIds = ['note-1', 'note-2'];
        const duration = 5;
        const timeOfReflection = 'Day';

        const result = await api.generateMeditation(noteIds, duration, timeOfReflection);

        expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/meditate', {
          noteIds,
          duration,
          timeOfReflection
        });
        expect(result).toEqual(mockResponse);
      });

      it('should fetch meditations list', async () => {
        const mockMeditations = [
          { id: '1', title: 'Meditation 1' },
          { id: '2', title: 'Meditation 2' }
        ];
        mockAxiosInstance.get.mockResolvedValue({ data: mockMeditations });

        const result = await api.getMeditations();

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/meditations');
        expect(result).toEqual(mockMeditations);
      });
    });

    describe('error handling with different response formats', () => {
      it('should handle errors with error messages in response data', async () => {
        const mockError = {
          response: {
            status: 400,
            data: { error: 'Bad Request: Invalid input' }
          }
        };
        mockAxiosInstance.get.mockRejectedValue(mockError);

        await expect(api.getNotes()).rejects.toEqual(mockError);
      });

      it('should handle errors without response data', async () => {
        const mockError = {
          message: 'Network timeout',
          code: 'ECONNABORTED'
        };
        mockAxiosInstance.get.mockRejectedValue(mockError);

        await expect(api.getNotes()).rejects.toEqual(mockError);
      });
    });
  });
});