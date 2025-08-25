import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth, SignedIn, SignedOut } from '../AuthContext';
import { mockSupabaseClient } from '../../test/mocks/supabase';
import { createMockUser } from '../../test/factories';

// Mock the supabase module
jest.mock('../../lib/supabase', () => ({
  supabase: mockSupabaseClient
}));

const TestComponent = () => {
  const auth = useAuth();
  
  return (
    <div>
      <div data-testid="user-id">{auth.user?.id || 'no-user'}</div>
      <div data-testid="loading">{auth.loading.toString()}</div>
      <button 
        data-testid="sign-out" 
        onClick={() => auth.signOut()}
      >
        Sign Out
      </button>
    </div>
  );
};

const ConditionalRenderTest = () => (
  <div>
    <SignedIn>
      <div data-testid="signed-in-content">Signed In Content</div>
    </SignedIn>
    <SignedOut>
      <div data-testid="signed-out-content">Signed Out Content</div>
    </SignedOut>
  </div>
);

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('AuthProvider', () => {
    it('should provide authentication context to children', async () => {
      const mockUser = createMockUser();
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: { user: mockUser, access_token: 'mock-token' } },
        error: null
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      expect(screen.getByTestId('user-id')).toHaveTextContent(mockUser.id);
    });

    it('should handle no initial session', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      expect(screen.getByTestId('user-id')).toHaveTextContent('no-user');
    });

    it('should listen for auth state changes', async () => {
      const mockUser = createMockUser();
      let authCallback: Function;

      mockSupabaseClient.auth.onAuthStateChange.mockImplementation((callback) => {
        authCallback = callback;
        return {
          data: {
            subscription: { unsubscribe: jest.fn() }
          }
        };
      });

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      // Simulate sign in
      act(() => {
        authCallback!('SIGNED_IN', { user: mockUser, access_token: 'mock-token' });
      });

      await waitFor(() => {
        expect(screen.getByTestId('user-id')).toHaveTextContent(mockUser.id);
      });
    });
  });

  describe('useAuth hook', () => {
    it('should throw error when used outside of AuthProvider', () => {
      const TestComponentWithoutProvider = () => {
        useAuth();
        return <div>Test</div>;
      };

      // Suppress console.error for this test
      const originalError = console.error;
      console.error = jest.fn();

      expect(() => {
        render(<TestComponentWithoutProvider />);
      }).toThrow('useAuth must be used within an AuthProvider');

      console.error = originalError;
    });

    it('should provide auth methods', async () => {
      const mockUser = createMockUser();
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: { user: mockUser, access_token: 'mock-token' } },
        error: null
      });

      const TestAuthMethods = () => {
        const auth = useAuth();
        
        return (
          <div>
            <button 
              data-testid="sign-up"
              onClick={() => auth.signUp('test@example.com', 'password')}
            >
              Sign Up
            </button>
            <button 
              data-testid="sign-in"
              onClick={() => auth.signIn('test@example.com', 'password')}
            >
              Sign In
            </button>
            <button 
              data-testid="get-token"
              onClick={async () => {
                const token = await auth.getToken();
                console.log('Token:', token);
              }}
            >
              Get Token
            </button>
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestAuthMethods />
        </AuthProvider>
      );

      // Test sign up
      await act(async () => {
        screen.getByTestId('sign-up').click();
      });

      expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password'
      });

      // Test sign in
      await act(async () => {
        screen.getByTestId('sign-in').click();
      });

      expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password'
      });

      // Test get token
      await act(async () => {
        screen.getByTestId('get-token').click();
      });

      expect(mockSupabaseClient.auth.getSession).toHaveBeenCalled();
    });
  });

  describe('SignedIn component', () => {
    it('should render children when user is signed in', async () => {
      const mockUser = createMockUser();
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: { user: mockUser, access_token: 'mock-token' } },
        error: null
      });

      render(
        <AuthProvider>
          <ConditionalRenderTest />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('signed-in-content')).toBeInTheDocument();
        expect(screen.queryByTestId('signed-out-content')).not.toBeInTheDocument();
      });
    });

    it('should show loading when auth is loading', async () => {
      // Simulate slow auth check
      mockSupabaseClient.auth.getSession.mockImplementation(() => 
        new Promise(resolve => {
          setTimeout(() => {
            resolve({ data: { session: null }, error: null });
          }, 100);
        })
      );

      render(
        <AuthProvider>
          <SignedIn>
            <div data-testid="signed-in-content">Signed In</div>
          </SignedIn>
        </AuthProvider>
      );

      // Should show loading initially
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.queryByTestId('signed-in-content')).not.toBeInTheDocument();

      // Wait for auth to resolve
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });
    });
  });

  describe('SignedOut component', () => {
    it('should render children when user is not signed in', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      });

      render(
        <AuthProvider>
          <ConditionalRenderTest />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('signed-out-content')).toBeInTheDocument();
        expect(screen.queryByTestId('signed-in-content')).not.toBeInTheDocument();
      });
    });

    it('should not render children when user is signed in', async () => {
      const mockUser = createMockUser();
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: { user: mockUser, access_token: 'mock-token' } },
        error: null
      });

      render(
        <AuthProvider>
          <SignedOut>
            <div data-testid="signed-out-content">Signed Out</div>
          </SignedOut>
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('signed-out-content')).not.toBeInTheDocument();
      });
    });
  });

  describe('error handling', () => {
    it('should handle auth errors gracefully', async () => {
      const mockError = new Error('Auth error');
      mockSupabaseClient.auth.signIn.mockRejectedValue(mockError);

      const TestErrorHandling = () => {
        const auth = useAuth();
        const [error, setError] = React.useState<string | null>(null);
        
        const handleSignIn = async () => {
          try {
            await auth.signIn('test@example.com', 'wrong-password');
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
          }
        };
        
        return (
          <div>
            <button data-testid="sign-in" onClick={handleSignIn}>
              Sign In
            </button>
            {error && <div data-testid="error">{error}</div>}
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestErrorHandling />
        </AuthProvider>
      );

      await act(async () => {
        screen.getByTestId('sign-in').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Auth error');
      });
    });
  });
});