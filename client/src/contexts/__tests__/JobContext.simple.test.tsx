import { jest } from '@jest/globals';
import React from 'react';
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import axios from 'axios';
jest.mock('axios');

const axiosMock = axios as unknown as {
  create: jest.Mock;
  request: jest.Mock;
};

(globalThis as any).__REPLAY_TEST_AUTH__ = {
  getToken: jest.fn().mockResolvedValue('test-bearer'),
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
  axiosMock.request.mockClear();
  axiosMock.request.mockResolvedValue({ data: { jobs: [] } });
  const jobModule = await import('../JobContext');
  JobProvider = jobModule.JobProvider;
  useJobs = jobModule.useJobs;
});

describe('JobContext auth integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (globalThis as any).__REPLAY_TEST_AUTH__.getToken.mockResolvedValue('test-bearer');
    axiosMock.request.mockReset();
    axiosMock.request.mockImplementation(() => Promise.resolve({ data: { jobs: [] } }));
    axiosMock.request
      .mockResolvedValueOnce({ data: { jobs: [] } })
      .mockResolvedValueOnce({ data: { jobId: 'job-1', status: 'pending', message: 'created' } })
      .mockResolvedValueOnce({ data: { jobs: [] } });
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

    const requestConfig = axiosMock.request.mock.calls[1][0];
    expect(requestConfig.headers.Authorization).toBe('Bearer test-bearer');
  });
});

afterAll(() => {
  delete (globalThis as any).__REPLAY_TEST_AUTH__;
});
