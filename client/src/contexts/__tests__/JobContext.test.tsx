import { jest } from '@jest/globals';
import React from 'react';
import { renderHook } from '@testing-library/react';
import { act } from 'react';

const requestMock = jest.fn();

jest.mock('axios', () => {
  const axiosMock: any = {
    create: jest.fn(() => axiosMock),
    request: requestMock,
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  };
  return { __esModule: true, default: axiosMock };
});

(globalThis as any).__REPLAY_TEST_AUTH__ = {
  getToken: jest.fn().mockResolvedValue('mock-jwt'),
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
  requestMock.mockResolvedValue({ data: { jobs: [] } });
  const jobModule = await import('../JobContext');
  JobProvider = jobModule.JobProvider;
  useJobs = jobModule.useJobs;
});

describe('JobContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (globalThis as any).__REPLAY_TEST_AUTH__.getToken.mockResolvedValue('mock-jwt');
    requestMock.mockReset();
    requestMock.mockImplementation(() => Promise.resolve({ data: { jobs: [] } }));
  });

  it('uses API client without double /api prefix', async () => {
    requestMock
      .mockResolvedValueOnce({ data: { jobs: [] } })
      .mockResolvedValueOnce({ data: { jobId: 'job-1', status: 'pending', message: 'created' } })
      .mockResolvedValueOnce({ data: { jobs: [] } });

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
