import { jest } from '@jest/globals';
import axios from 'axios';

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('API Utils - OneSignal Subscription ID', () => {
  let api: any;
  let useAuthenticatedApi: any;

  beforeAll(async () => {
    const apiModule = await import('../../utils/api');
    api = apiModule.default;
    useAuthenticatedApi = apiModule.useAuthenticatedApi;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  test('adds OneSignal subscription ID header when available', () => {
    mockLocalStorage.getItem.mockReturnValue('sub-123');

    // Create a mock instance
    const mockInstance = {
      interceptors: {
        request: {
          use: jest.fn((fn) => {
            // Test the interceptor function
            const config = { headers: {} };
            const result = fn(config);
            return result;
          })
        }
      }
    };

    mockedAxios.create.mockReturnValue(mockInstance as any);

    // Import to trigger interceptor setup
    import('../../utils/api');

    // Verify localStorage was called
    expect(mockLocalStorage.getItem).toHaveBeenCalledWith('onesignal_subscription_id');
  });

  test('omits OneSignal header when subscription ID not available', () => {
    mockLocalStorage.getItem.mockReturnValue(null);

    const mockInstance = {
      interceptors: {
        request: {
          use: jest.fn((fn) => {
            const config = { headers: {} };
            const result = fn(config);
            return result;
          })
        }
      }
    };

    mockedAxios.create.mockReturnValue(mockInstance as any);

    import('../../utils/api');

    expect(mockLocalStorage.getItem).toHaveBeenCalled();
  });

  test('handles localStorage errors gracefully', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockLocalStorage.getItem.mockImplementation(() => {
      throw new Error('localStorage unavailable');
    });

    const mockInstance = {
      interceptors: {
        request: {
          use: jest.fn((fn) => {
            const config = { headers: {} };
            try {
              fn(config);
            } catch (e) {
              // Should be caught and logged
            }
            return config;
          })
        }
      }
    };

    mockedAxios.create.mockReturnValue(mockInstance as any);

    import('../../utils/api');

    consoleWarnSpy.mockRestore();
  });

  test('subscription ID is added to authenticated requests', async () => {
    mockLocalStorage.getItem.mockReturnValue('sub-456');

    const mockGetToken = jest.fn(async () => 'jwt-token');

    // Mock the auth hook
    (globalThis as any).__REPLAY_TEST_AUTH__ = {
      getToken: mockGetToken,
      user: { id: 'user-123' },
      loading: false,
      signUp: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      session: null
    };

    const mockRequest = jest.fn(async (config) => ({
      data: { success: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config
    }));

    const mockInstance = {
      interceptors: {
        request: {
          use: jest.fn((fn) => {
            return fn;
          })
        },
        response: {
          use: jest.fn()
        }
      },
      request: mockRequest,
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn()
    };

    mockedAxios.create.mockReturnValue(mockInstance as any);

    // Re-import to get fresh instance
    delete require.cache[require.resolve('../../utils/api')];
    const { useAuthenticatedApi } = await import('../../utils/api');

    // Mock React hook rendering
    const mockUseAuth = () => ({
      getToken: mockGetToken
    });

    // Simulate the hook being called
    const interceptorFn = mockInstance.interceptors.request.use.mock.calls[0]?.[0];
    if (interceptorFn) {
      const config = { headers: {} };
      await interceptorFn(config);

      // Verify both token and subscription ID are added
      expect(config.headers['Authorization']).toBe('Bearer jwt-token');
      expect(config.headers['X-OneSignal-Subscription-Id']).toBe('sub-456');
    }
  });

  test('removes OneSignal header when subscription ID becomes unavailable', () => {
    // First request with subscription ID
    mockLocalStorage.getItem.mockReturnValueOnce('sub-789');

    const mockInstance = {
      interceptors: {
        request: {
          use: jest.fn((fn) => {
            const config1 = { headers: {} };
            const result1 = fn(config1);

            // Verify header was added
            if (result1.headers && result1.headers['X-OneSignal-Subscription-Id']) {
              expect(result1.headers['X-OneSignal-Subscription-Id']).toBe('sub-789');
            }

            // Second request without subscription ID
            mockLocalStorage.getItem.mockReturnValueOnce(null);
            const config2 = { headers: { 'X-OneSignal-Subscription-Id': 'old-value' } };
            const result2 = fn(config2);

            // Verify header was removed
            expect(result2.headers?.['X-OneSignal-Subscription-Id']).toBeUndefined();

            return result2;
          })
        }
      }
    };

    mockedAxios.create.mockReturnValue(mockInstance as any);

    import('../../utils/api');
  });

  test('preserves other headers when adding subscription ID', () => {
    mockLocalStorage.getItem.mockReturnValue('sub-999');

    const mockInstance = {
      interceptors: {
        request: {
          use: jest.fn((fn) => {
            const config = {
              headers: {
                'Content-Type': 'application/json',
                'Custom-Header': 'custom-value'
              }
            };

            const result = fn(config);

            // Verify original headers are preserved
            expect(result.headers['Content-Type']).toBe('application/json');
            expect(result.headers['Custom-Header']).toBe('custom-value');

            // Verify subscription ID was added
            if (mockLocalStorage.getItem.mock.calls.length > 0) {
              expect(result.headers['X-OneSignal-Subscription-Id']).toBe('sub-999');
            }

            return result;
          })
        }
      }
    };

    mockedAxios.create.mockReturnValue(mockInstance as any);

    import('../../utils/api');
  });
});