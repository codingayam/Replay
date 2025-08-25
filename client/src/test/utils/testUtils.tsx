import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import { mockSupabaseClient } from '../mocks/supabase';

// Mock the supabase module for all test utilities
jest.mock('../../lib/supabase', () => ({
  supabase: mockSupabaseClient
}));

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialEntries?: string[];
  withAuth?: boolean;
  authState?: {
    user: any;
    session: any;
    loading: boolean;
  };
}

/**
 * Custom render function that includes common providers
 * Use this instead of the default render from @testing-library/react
 */
const customRender = (
  ui: ReactElement,
  {
    initialEntries = ['/'],
    withAuth = true,
    authState,
    ...renderOptions
  }: CustomRenderOptions = {}
) => {
  // Setup auth mock if authState is provided
  if (authState) {
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: authState.session },
      error: null
    });
  }

  const AllTheProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
      <BrowserRouter>
        {withAuth ? (
          <AuthProvider>
            {children}
          </AuthProvider>
        ) : (
          children
        )}
      </BrowserRouter>
    );
  };

  return render(ui, { wrapper: AllTheProviders, ...renderOptions });
};

/**
 * Render component with authenticated user context
 */
export const renderWithAuth = (ui: ReactElement, options: Omit<CustomRenderOptions, 'withAuth'> = {}) => {
  const mockUser = {
    id: 'test-user-123',
    email: 'test@example.com',
    created_at: new Date().toISOString()
  };

  return customRender(ui, {
    ...options,
    withAuth: true,
    authState: {
      user: mockUser,
      session: { access_token: 'mock-token', user: mockUser },
      loading: false
    }
  });
};

/**
 * Render component without authentication (signed out state)
 */
export const renderWithoutAuth = (ui: ReactElement, options: Omit<CustomRenderOptions, 'withAuth'> = {}) => {
  return customRender(ui, {
    ...options,
    withAuth: true,
    authState: {
      user: null,
      session: null,
      loading: false
    }
  });
};

/**
 * Render component with loading auth state
 */
export const renderWithAuthLoading = (ui: ReactElement, options: Omit<CustomRenderOptions, 'withAuth'> = {}) => {
  return customRender(ui, {
    ...options,
    withAuth: true,
    authState: {
      user: null,
      session: null,
      loading: true
    }
  });
};

/**
 * Test utilities for async operations
 */
export const waitForLoadingToFinish = () => {
  // Wait for any loading states to complete
  return new Promise(resolve => setTimeout(resolve, 0));
};

export const flushPromises = () => {
  return new Promise(resolve => setImmediate(resolve));
};

/**
 * Mock user interactions
 */
export const createMockEvent = (eventType: string, eventData: any = {}) => {
  const event = new Event(eventType, { bubbles: true });
  Object.assign(event, eventData);
  return event;
};

export const createMockFileEvent = (files: File[]) => {
  const input = document.createElement('input');
  input.type = 'file';
  Object.defineProperty(input, 'files', {
    value: files,
    writable: false,
  });
  
  return createMockEvent('change', {
    target: input,
    currentTarget: input
  });
};

/**
 * Local Storage utilities for testing
 */
export const mockLocalStorage = () => {
  const store: Record<string, string> = {};
  
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
    }),
    get store() {
      return { ...store };
    }
  };
};

/**
 * Setup and teardown helpers
 */
export const setupAuthenticatedTest = () => {
  beforeEach(() => {
    const mockUser = {
      id: 'test-user-123',
      email: 'test@example.com'
    };

    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'mock-token', user: mockUser } },
      error: null
    });

    mockSupabaseClient.auth.onAuthStateChange.mockImplementation((callback) => {
      callback('SIGNED_IN', { access_token: 'mock-token', user: mockUser });
      return {
        data: {
          subscription: { unsubscribe: jest.fn() }
        }
      };
    });
  });
};

export const setupUnauthenticatedTest = () => {
  beforeEach(() => {
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null
    });

    mockSupabaseClient.auth.onAuthStateChange.mockImplementation((callback) => {
      callback('SIGNED_OUT', null);
      return {
        data: {
          subscription: { unsubscribe: jest.fn() }
        }
      };
    });
  });
};

/**
 * Common test assertions
 */
export const expectElementToBeVisible = (element: HTMLElement | null) => {
  expect(element).toBeInTheDocument();
  expect(element).toBeVisible();
};

export const expectElementToHaveText = (element: HTMLElement | null, text: string | RegExp) => {
  expect(element).toBeInTheDocument();
  expect(element).toHaveTextContent(text);
};

export const expectFormValidation = async (
  form: HTMLElement,
  invalidInputs: Record<string, string>,
  expectedErrors: string[]
) => {
  // Fill form with invalid data
  Object.entries(invalidInputs).forEach(([testId, value]) => {
    const input = form.querySelector(`[data-testid="${testId}"]`) as HTMLInputElement;
    if (input) {
      input.value = value;
      input.dispatchEvent(createMockEvent('change'));
    }
  });

  // Submit form
  const submitButton = form.querySelector('[type="submit"]') as HTMLButtonElement;
  if (submitButton) {
    submitButton.click();
  }

  // Wait for validation
  await waitForLoadingToFinish();

  // Check for expected errors
  expectedErrors.forEach(error => {
    const errorElement = form.querySelector(`[role="alert"]:contains("${error}"), .error:contains("${error}")`);
    expect(errorElement).toBeInTheDocument();
  });
};

/**
 * Network request mocking helpers
 */
export const mockNetworkError = () => {
  return new Error('Network Error');
};

export const mockApiError = (status: number, message: string) => {
  const error = new Error(message) as any;
  error.response = {
    status,
    data: { error: message }
  };
  return error;
};

/**
 * Date and time utilities for testing
 */
export const mockDateNow = (timestamp: number) => {
  const originalNow = Date.now;
  Date.now = jest.fn(() => timestamp);
  
  return () => {
    Date.now = originalNow;
  };
};

export const createMockDate = (dateString: string) => {
  return new Date(dateString);
};

/**
 * Component testing utilities
 */
export const getByTestIdOrThrow = (container: HTMLElement, testId: string) => {
  const element = container.querySelector(`[data-testid="${testId}"]`);
  if (!element) {
    throw new Error(`Element with data-testid="${testId}" not found`);
  }
  return element;
};

export const queryByTestId = (container: HTMLElement, testId: string) => {
  return container.querySelector(`[data-testid="${testId}"]`);
};

/**
 * Audio/Media testing utilities
 */
export const mockMediaRecorder = () => {
  const mockRecorder = {
    start: jest.fn(),
    stop: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    requestData: jest.fn(),
    state: 'inactive',
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    ondataavailable: null,
    onstop: null,
    onstart: null,
    onerror: null
  };

  global.MediaRecorder = jest.fn(() => mockRecorder) as any;
  
  return mockRecorder;
};

export const simulateRecording = (mockRecorder: any, audioData: Blob = new Blob(['mock-audio'])) => {
  // Simulate starting recording
  mockRecorder.state = 'recording';
  if (mockRecorder.onstart) {
    mockRecorder.onstart(new Event('start'));
  }

  // Simulate data available
  const dataEvent = new CustomEvent('dataavailable');
  Object.defineProperty(dataEvent, 'data', {
    value: audioData,
    writable: false
  });
  
  if (mockRecorder.ondataavailable) {
    mockRecorder.ondataavailable(dataEvent);
  }

  // Simulate stop
  mockRecorder.state = 'inactive';
  if (mockRecorder.onstop) {
    mockRecorder.onstop(new Event('stop'));
  }
};

// Re-export everything from @testing-library/react
export * from '@testing-library/react';

// Override the default render
export { customRender as render };