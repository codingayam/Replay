import { jest } from '@jest/globals';
import React from 'react';
import { render, waitFor } from '@testing-library/react';

const mockGet = jest.fn();

jest.unstable_mockModule('../utils/api', () => ({
  useAuthenticatedApi: () => ({
    get: mockGet
  })
}));

const profileModule = await import('../contexts/ProfileContext');
const { ProfileProvider, useProfile } = profileModule;

const TestConsumer: React.FC = () => {
  const { profile, isOnboarded, currentStep, totalSteps } = useProfile();
  return (
    <div>
      <span data-testid="name">{profile?.name ?? 'none'}</span>
      <span data-testid="status">{isOnboarded ? 'onboarded' : 'pending'}</span>
      <span data-testid="steps">{currentStep}/{totalSteps}</span>
    </div>
  );
};

describe('ProfileProvider', () => {
  beforeEach(() => {
    mockGet.mockReset();
    (globalThis as any).__REPLAY_TEST_AUTH__ = {
      user: { id: 'user-1', email: 'user@example.com', user_metadata: {} },
      session: null,
      loading: false,
      authReady: true,
      signUp: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      getToken: jest.fn().mockResolvedValue('token'),
      signInWithGoogle: jest.fn()
    };
  });

  afterEach(() => {
    delete (globalThis as any).__REPLAY_TEST_AUTH__;
  });

  it('loads profile and sets onboarded flag when completed', async () => {
    mockGet.mockResolvedValue({
      data: {
        profile: {
          name: 'Replay User',
          onboarding_completed: true,
          onboarding_step: 6
        }
      }
    });

    const { getByTestId } = render(
      <ProfileProvider>
        <TestConsumer />
      </ProfileProvider>
    );

    await waitFor(() => expect(getByTestId('status').textContent).toBe('onboarded'));
    expect(getByTestId('name').textContent).toBe('Replay User');
    expect(getByTestId('steps').textContent).toBe('6/6');
  });

  it('tracks onboarding progress when not completed', async () => {
    mockGet.mockResolvedValue({
      data: {
        profile: {
          name: 'Replay User',
          onboarding_completed: false,
          onboarding_step: 2
        }
      }
    });

    const { getByTestId } = render(
      <ProfileProvider>
        <TestConsumer />
      </ProfileProvider>
    );

    await waitFor(() => expect(getByTestId('status').textContent).toBe('pending'));
    expect(getByTestId('steps').textContent).toBe('2/6');
  });
});
