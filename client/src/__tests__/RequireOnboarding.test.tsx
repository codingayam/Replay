import { jest } from '@jest/globals';
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RequireOnboarding from '../components/RequireOnboarding';

const renderWithRouter = (profileContext: any, initialPath = '/experiences') => {
  (globalThis as any).__REPLAY_TEST_PROFILE_CONTEXT__ = profileContext;
  (globalThis as any).__REPLAY_TEST_AUTH__ = {
    user: { id: 'user-1', email: 'user@example.com', user_metadata: {} },
    session: null,
    loading: false,
    authReady: true,
    signUp: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
    getToken: jest.fn(),
    signInWithGoogle: jest.fn()
  };

  const view = render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/experiences"
          element={
            <RequireOnboarding>
              <div>Experiences</div>
            </RequireOnboarding>
          }
        />
        <Route path="/onboarding" element={<div>Onboarding</div>} />
      </Routes>
    </MemoryRouter>
  );

  return view;
};

describe('RequireOnboarding', () => {
  afterEach(() => {
    delete (globalThis as any).__REPLAY_TEST_PROFILE_CONTEXT__;
    delete (globalThis as any).__REPLAY_TEST_AUTH__;
  });

  it('redirects unfinished users to onboarding', async () => {
    const { getByText } = renderWithRouter({
      profile: null,
      isLoading: false,
      error: null,
      refreshProfile: jest.fn(),
      isOnboarded: false,
      currentStep: 2,
      totalSteps: 6,
      setCurrentStep: jest.fn(),
      updateLocalProfile: jest.fn()
    });

    await waitFor(() => expect(getByText('Onboarding')).toBeInTheDocument());
  });

  it('allows onboarded users to continue', async () => {
    const { getByText } = renderWithRouter({
      profile: { name: 'Replay User' },
      isLoading: false,
      error: null,
      refreshProfile: jest.fn(),
      isOnboarded: true,
      currentStep: 6,
      totalSteps: 6,
      setCurrentStep: jest.fn(),
      updateLocalProfile: jest.fn()
    });

    await waitFor(() => expect(getByText('Experiences')).toBeInTheDocument());
  });
});
