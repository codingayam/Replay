import { jest } from '@jest/globals';

type TestClient = {
  interceptors: {
    request: {
      use: jest.Mock;
    };
    response: {
      use: jest.Mock;
    };
  };
  request: jest.Mock;
  get: jest.Mock;
  post: jest.Mock;
  put: jest.Mock;
  delete: jest.Mock;
  __requestInterceptors: Array<(config: any) => any>;
  __responseInterceptors: Array<{ onFulfilled: (value: any) => any; onRejected?: (error: any) => any }>;
};

const createTestClient = (): TestClient => {
  const requestInterceptors: Array<(config: any) => any> = [];
  const responseInterceptors: Array<{ onFulfilled: (value: any) => any; onRejected?: (error: any) => any }> = [];

  return {
    interceptors: {
      request: {
        use: jest.fn((fn: (config: any) => any) => {
          requestInterceptors.push(fn);
          return fn;
        })
      },
      response: {
        use: jest.fn((onFulfilled: (value: any) => any, onRejected?: (error: any) => any) => {
          responseInterceptors.push({ onFulfilled, onRejected });
          return { eject: jest.fn() };
        })
      }
    },
    request: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    __requestInterceptors: requestInterceptors,
    __responseInterceptors: responseInterceptors
  };
};

const loadApiWithClient = async (client: TestClient) => {
  jest.resetModules();
  (globalThis as any).__REPLAY_TEST_API_CLIENT__ = client;
  try {
    await jest.unstable_mockModule('../../lib/supabase', () => ({
      supabase: {
        auth: {
          signOut: jest.fn(),
          getSession: jest.fn(async () => ({ data: { session: null }, error: null }))
        }
      }
    }));
    return await import('../../utils/api');
  } catch (error) {
    console.error('Failed to load api utils during test:', error);
    throw error;
  }
};

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

describe('API Utils - OneSignal Subscription ID', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    delete (globalThis as any).__REPLAY_TEST_API_CLIENT__;
  });

  test('adds OneSignal subscription ID header when available', async () => {
    mockLocalStorage.getItem.mockReturnValue('sub-123');

    const client = createTestClient();
    await loadApiWithClient(client);

    expect(client.interceptors.request.use).toHaveBeenCalled();
    expect(client.__requestInterceptors.length).toBeGreaterThan(0);
    const interceptor = client.__requestInterceptors[0];
    const config: any = { headers: {} };
    interceptor(config);

    expect(mockLocalStorage.getItem).toHaveBeenCalledWith('onesignal_subscription_id');
    expect(config.headers['X-OneSignal-Subscription-Id']).toBe('sub-123');
  });

  test('omits OneSignal header when subscription ID not available', async () => {
    const client = createTestClient();

    await loadApiWithClient(client);

    expect(client.__requestInterceptors.length).toBeGreaterThan(0);
    const interceptor = client.__requestInterceptors[0];
    const config: any = { headers: {} };
    interceptor(config);

    expect(mockLocalStorage.getItem).toHaveBeenCalled();
    expect(config.headers['X-OneSignal-Subscription-Id']).toBeUndefined();
  });

  test('handles localStorage errors gracefully', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockLocalStorage.getItem.mockImplementation(() => {
      throw new Error('localStorage unavailable');
    });

    const client = createTestClient();
    await loadApiWithClient(client);

    expect(client.__requestInterceptors.length).toBeGreaterThan(0);
    const interceptor = client.__requestInterceptors[0];
    const config: any = { headers: {} };
    interceptor(config);

    expect(consoleWarnSpy).toHaveBeenCalled();
    consoleWarnSpy.mockRestore();
  });

  test('subscription ID is added to authenticated requests', async () => {
    mockLocalStorage.getItem.mockReturnValue('sub-456');

    const mockGetToken = jest.fn(async () => 'jwt-token');

    (globalThis as any).__REPLAY_TEST_AUTH__ = {
      getToken: mockGetToken,
      user: { id: 'user-123' },
      loading: false,
      authReady: true,
      signUp: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      signInWithGoogle: jest.fn(),
      session: null
    };

    const client = createTestClient();
    const { useAuthenticatedApi } = await loadApiWithClient(client);
    expect(typeof useAuthenticatedApi).toBe('function');

    expect(client.__requestInterceptors.length).toBeGreaterThan(0);
    const interceptorFn = client.__requestInterceptors[0];
    expect(interceptorFn).toBeDefined();

    const config: any = { headers: {} };
    await interceptorFn(config);

    expect(readHeader(config.headers, 'X-OneSignal-Subscription-Id')).toBe('sub-456');

    delete (globalThis as any).__REPLAY_TEST_AUTH__;
  });

  test('removes OneSignal header when subscription ID becomes unavailable', async () => {
    mockLocalStorage.getItem.mockReturnValueOnce('sub-789');

    const client = createTestClient();
    await loadApiWithClient(client);

    expect(client.__requestInterceptors.length).toBeGreaterThan(0);
    const interceptor = client.__requestInterceptors[0];
    const config1: any = { headers: {} };
    const result1 = interceptor(config1);
    expect(readHeader(result1.headers, 'X-OneSignal-Subscription-Id')).toBe('sub-789');

    mockLocalStorage.getItem.mockReturnValueOnce(null);
    const config2: any = { headers: { 'X-OneSignal-Subscription-Id': 'old-value' } };
    const result2 = interceptor(config2);
    expect(readHeader(result2.headers, 'X-OneSignal-Subscription-Id')).toBeUndefined();
  });

  test('preserves other headers when adding subscription ID', async () => {
    mockLocalStorage.getItem.mockReturnValue('sub-999');

    const client = createTestClient();
    await loadApiWithClient(client);

    expect(client.__requestInterceptors.length).toBeGreaterThan(0);
    const interceptor = client.__requestInterceptors[0];
    const config: any = {
      headers: {
        'Content-Type': 'application/json',
        'Custom-Header': 'custom-value'
      }
    };
    const result = interceptor(config);
    expect(readHeader(result.headers, 'Content-Type')).toBe('application/json');
    expect(readHeader(result.headers, 'Custom-Header')).toBe('custom-value');
    expect(readHeader(result.headers, 'X-OneSignal-Subscription-Id')).toBe('sub-999');
  });
});

function readHeader(headers: any, key: string) {
  if (headers && typeof headers.get === 'function') {
    return headers.get(key);
  }
  return headers ? headers[key] : undefined;
}
