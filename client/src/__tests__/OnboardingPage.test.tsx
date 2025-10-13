import { jest } from '@jest/globals';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const mockPost = jest.fn();

jest.unstable_mockModule('../utils/api', () => ({
  useAuthenticatedApi: () => ({
    post: mockPost
  })
}));

const onboardingModule = await import('../pages/OnboardingPage');
const OnboardingPage = onboardingModule.default;

const PathWatcher: React.FC = () => {
  const location = useLocation();
  return <div data-testid="current-path">{location.pathname}</div>;
};

describe('OnboardingPage', () => {
  const mockSetCurrentStep = jest.fn();
  const mockUpdateLocalProfile = jest.fn();
  const mockRefreshProfile = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    mockPost.mockReset();
    mockSetCurrentStep.mockReset();
    mockUpdateLocalProfile.mockReset();
    mockRefreshProfile.mockClear();

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

    (globalThis as any).__REPLAY_TEST_PROFILE_CONTEXT__ = {
      profile: null,
      isLoading: false,
      error: null,
      refreshProfile: mockRefreshProfile,
      isOnboarded: false,
      currentStep: 0,
      totalSteps: 6,
      setCurrentStep: mockSetCurrentStep,
      updateLocalProfile: mockUpdateLocalProfile
    };

    mockPost.mockResolvedValue({ data: { profile: {} } });
  });

  afterEach(() => {
    delete (globalThis as any).__REPLAY_TEST_AUTH__;
    delete (globalThis as any).__REPLAY_TEST_PROFILE_CONTEXT__;
  });

  it('submits onboarding details and navigates to experiences', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={[{ pathname: '/onboarding' }] }>
        <Routes>
          <Route path="/onboarding" element={<><OnboardingPage /><PathWatcher /></>} />
          <Route path="/experiences" element={<div>Experiences Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: /show me how it works/i }));
    await user.click(screen.getByRole('button', { name: /let.?s go/i }));

    const nameInput = screen.getByLabelText(/preferred name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Replay');
    await user.click(screen.getByRole('button', { name: /next/i }));

    await user.click(screen.getByRole('button', { name: /leave blank for now/i }));
    await user.click(screen.getByRole('button', { name: /leave blank for now/i }));

    expect(screen.getByText(/thank you!/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /start exploring replay/i }));

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    expect(mockPost).toHaveBeenCalledWith('/profile', {
      name: 'Replay',
      values: [],
      mission: '',
      thinking_about: '',
      onboarding_step: 6,
      onboarding_completed: true
    });

    expect(mockSetCurrentStep).toHaveBeenCalledWith(6);
    expect(mockRefreshProfile).toHaveBeenCalled();

    await waitFor(() => expect(screen.getByText('Experiences Page')).toBeInTheDocument());
  });
});
