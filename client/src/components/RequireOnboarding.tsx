import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useProfile } from '../contexts/ProfileContext';
import { useAuth } from '../contexts/AuthContext';

interface RequireOnboardingProps {
  children: React.ReactNode;
}

const RequireOnboarding: React.FC<RequireOnboardingProps> = ({ children }) => {
  const location = useLocation();
  const { isLoading: authLoading } = useAuth();
  const { isLoading: profileLoading, isOnboarded, totalSteps, currentStep } = useProfile();

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div>Loading…</div>
      </div>
    );
  }

  if (!isOnboarded) {
    if (location.pathname !== '/onboarding') {
      return <Navigate to="/onboarding" replace state={{ from: location.pathname, step: currentStep, totalSteps }} />;
    }
  }

  if (isOnboarded && location.pathname === '/onboarding') {
    return <Navigate to="/experiences" replace />;
  }

  return <>{children}</>;
};

export default RequireOnboarding;
