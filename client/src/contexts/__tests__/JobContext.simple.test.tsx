import { jest } from '@jest/globals';
import type { MockedFunction } from 'jest-mock';
import React from 'react';
import { renderHook } from '@testing-library/react';
import { act } from 'react';

type RequestConfig = {
  method: string;
  url: string;
  data?: unknown;
  headers?: Record<string, string>;
};

const requestMock = jest.fn() as MockedFunction<
  (config: RequestConfig) => Promise<{ data: any }>
>;

const getTokenMock = jest.fn(async () => 'test-bearer') as jest.MockedFunction<() => Promise<string | null>>;

(globalThis as any).__REPLAY_TEST_AUTH__ = {
  getToken: getTokenMock,
  user: { id: 'user-123' },
  loading: false,
  authReady: true,
  signUp: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
  signInWithGoogle: jest.fn(),
  session: null,
};

let JobProvider: typeof import('../JobContext').JobProvider;
let useJobs: typeof import('../JobContext').useJobs;

beforeAll(async () => {
  const jobModule = await import('../JobContext');
  JobProvider = jobModule.JobProvider;
  useJobs = jobModule.useJobs;
});

describe('JobContext auth integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getTokenMock.mockResolvedValue('test-bearer');
    requestMock.mockReset();
    requestMock.mockImplementation(async (config) => {
      if (config.method === 'POST' && config.url === '/meditate/jobs') {
        return { data: { jobId: 'job-1', status: 'pending', message: 'created' } };
      }

      return { data: { jobs: [] } };
    });
    (globalThis as any).__REPLAY_TEST_API_CLIENT__ = {
      request: requestMock,
    };
  });

  it('attaches bearer token to job creation requests', async () => {
    const { result } = renderHook(() => useJobs(), {
      wrapper: ({ children }) => <JobProvider>{children}</JobProvider>,
    });

    await act(async () => {
      await result.current.createJob({
        noteIds: ['1'],
        duration: 10,
        reflectionType: 'Meditation',
      } as any);
    });

    expect(requestMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-bearer' }),
      })
    );
  });

  afterEach(() => {
    delete (globalThis as any).__REPLAY_TEST_API_CLIENT__;
  });
});

afterAll(() => {
  delete (globalThis as any).__REPLAY_TEST_AUTH__;
  delete (globalThis as any).__REPLAY_TEST_API_CLIENT__;
});
