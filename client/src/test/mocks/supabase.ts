import { mockUser } from '../fixtures/data';

// Mock Supabase client
export const createMockSupabaseClient = () => {
  const mockAuth = {
    getSession: jest.fn().mockResolvedValue({
      data: { session: { user: mockUser, access_token: 'mock-token' } },
      error: null
    }),
    
    onAuthStateChange: jest.fn().mockImplementation((callback) => {
      // Immediately call with mock session
      callback('SIGNED_IN', { user: mockUser, access_token: 'mock-token' });
      
      return {
        data: {
          subscription: {
            unsubscribe: jest.fn()
          }
        }
      };
    }),
    
    signUp: jest.fn().mockResolvedValue({
      data: { user: mockUser },
      error: null
    }),
    
    signInWithPassword: jest.fn().mockResolvedValue({
      data: { user: mockUser, session: { access_token: 'mock-token' } },
      error: null
    }),
    
    signOut: jest.fn().mockResolvedValue({
      error: null
    }),
    
    getUser: jest.fn().mockResolvedValue({
      data: { user: mockUser },
      error: null
    })
  };

  const mockStorage = {
    from: jest.fn().mockImplementation((bucket: string) => ({
      upload: jest.fn().mockResolvedValue({
        data: { path: `${bucket}/mock-file.ext` },
        error: null
      }),
      
      createSignedUrl: jest.fn().mockResolvedValue({
        data: { signedUrl: `https://mock-storage.com/${bucket}/mock-file.ext?signed=true` },
        error: null
      }),
      
      remove: jest.fn().mockResolvedValue({
        data: null,
        error: null
      })
    }))
  };

  return {
    auth: mockAuth,
    storage: mockStorage
  };
};

export const mockSupabaseClient = createMockSupabaseClient();

// Mock the supabase module
jest.mock('../../lib/supabase', () => ({
  supabase: mockSupabaseClient
}));

export default mockSupabaseClient;