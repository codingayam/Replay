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

const getTokenMock = jest.fn(async () => 'test-bearer') as jest.MockedFunction<() => Promise<string | null>>;

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
});

afterAll(() => {
  delete (globalThis as any).__REPLAY_TEST_AUTH__;
});
