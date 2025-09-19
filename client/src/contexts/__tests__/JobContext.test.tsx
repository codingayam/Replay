import { jest } from '@jest/globals';
import React from 'react';
import { renderHook } from '@testing-library/react';
import { act } from 'react';

const requestMock = jest.fn(async () => ({ data: { jobs: [] } })) as jest.MockedFunction<
  (config: { method: string; url: string; data?: unknown; headers?: Record<string, string> }) => Promise<any>
>;

jest.mock('../../utils/api', () => ({
  __esModule: true,
  default: {
    request: (config: any) => requestMock(config),
  },
}));

const getTokenMock = jest.fn(async () => 'mock-jwt') as jest.MockedFunction<() => Promise<string | null>>;

(globalThis as any).__REPLAY_TEST_AUTH__ = {
  getToken: getTokenMock,
  user: { id: 'user-123' },
  loading: false,
  signUp: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
  session: null,
};

let JobProvider: typeof import('../JobContext').JobProvider;
let useJobs: typeof import('../JobContext').useJobs;

beforeAll(async () => {
  const jobModule = await import('../JobContext');
  JobProvider = jobModule.JobProvider;
  useJobs = jobModule.useJobs;
});

describe('JobContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getTokenMock.mockResolvedValue('mock-jwt');
    requestMock.mockReset();
    requestMock.mockImplementation(async (config) => {
      if (config.method === 'POST' && config.url === '/meditate/jobs') {
        return { data: { jobId: 'job-1', status: 'pending', message: 'created' } };
      }

      return { data: { jobs: [] } };
    });
  });

  it('uses API client without double /api prefix', async () => {
    const { result } = renderHook(() => useJobs(), {
      wrapper: ({ children }) => <JobProvider>{children}</JobProvider>,
    });

    await act(async () => {
      await result.current.createJob({
        noteIds: ['1'],
        duration: 5,
        reflectionType: 'Meditation',
      } as any);
    });

    const requestConfig = requestMock.mock.calls[1][0];
    expect(requestConfig.url).toBe('/meditate/jobs');
  });
});

afterAll(() => {
  delete (globalThis as any).__REPLAY_TEST_AUTH__;
});
