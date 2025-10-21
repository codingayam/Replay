import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider, SignedIn, SignedOut } from './contexts/AuthContext';
import { JobProvider } from './contexts/JobContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import ExperiencesPage from './pages/ExperiencesPage';
import ReflectionsPage from './pages/ReflectionsPage';
import ProfilePage from './pages/ProfilePage';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import OnboardingPage from './pages/OnboardingPage';
import EmailConfirmationPage from './pages/EmailConfirmationPage';
import HomePage from './pages/HomePage';
import BottomTabNavigation from './components/BottomTabNavigation';
import DesktopLayout from './components/DesktopLayout';
import BackgroundJobIndicator from './components/BackgroundJobIndicator';
import { useResponsive } from './hooks/useResponsive';
import AuthCallbackPage from './pages/AuthCallbackPage';
import { WeeklyProgressProvider } from './contexts/WeeklyProgressContext';
import { ProfileProvider } from './contexts/ProfileContext';
import RequireOnboarding from './components/RequireOnboarding';

function App() {
  return (
    <AuthProvider>
      <SubscriptionProvider>
        <ProfileProvider>
          <WeeklyProgressProvider>
            <JobProvider>
            <Router>
        <Routes>
          {/* Public Routes - Authentication */}
          <Route 
            path="/login" 
            element={
              <>
                <SignedIn>
                  <Navigate to="/experiences" replace />
                </SignedIn>
                <SignedOut>
                  <LoginPage />
                </SignedOut>
              </>
            } 
          />
          <Route
            path="/signup"
            element={
              <>
                <SignedIn>
                  <Navigate to="/experiences" replace />
                </SignedIn>
                <SignedOut>
                  <SignUpPage />
                </SignedOut>
              </>
            }
          />
          <Route
            path="/confirm-email"
            element={<EmailConfirmationPage />}
          />
          <Route
            path="/home"
            element={<HomePage />}
          />
          <Route
            path="/forgot-password"
            element={
              <>
                <SignedIn>
                  <Navigate to="/experiences" replace />
                </SignedIn>
                <SignedOut>
                  <ForgotPasswordPage />
                </SignedOut>
              </>
            }
          />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          
          {/* Protected Routes - Main App */}
          <Route 
            path="/onboarding" 
            element={
              <SignedIn>
                <RequireOnboarding>
                  <OnboardingPage />
                </RequireOnboarding>
              </SignedIn>
            } 
          />
          <Route 
            path="/experiences" 
            element={
              <SignedIn>
                <RequireOnboarding>
                  <AppLayout>
                    <ExperiencesPage />
                  </AppLayout>
                </RequireOnboarding>
              </SignedIn>
            } 
          />
          <Route 
            path="/reflections" 
            element={
              <SignedIn>
                <RequireOnboarding>
                  <AppLayout>
                    <ReflectionsPage />
                  </AppLayout>
                </RequireOnboarding>
              </SignedIn>
            } 
          />
          <Route
            path="/profile"
            element={
              <SignedIn>
                <RequireOnboarding>
                  <AppLayout>
                    <ProfilePage />
                  </AppLayout>
                </RequireOnboarding>
              </SignedIn>
            }
          />
          {/* Default Routes */}
          <Route 
            path="/" 
            element={
              <>
                <SignedIn>
                  <Navigate to="/experiences" replace />
                </SignedIn>
                <SignedOut>
                  <Navigate to="/login" replace />
                </SignedOut>
              </>
            } 
          />
          
          {/* Catch all route */}
          <Route 
            path="*" 
            element={
              <>
                <SignedIn>
                  <Navigate to="/experiences" replace />
                </SignedIn>
                <SignedOut>
                  <Navigate to="/login" replace />
                </SignedOut>
              </>
            } 
          />
              </Routes>
            </Router>
          </JobProvider>
        </WeeklyProgressProvider>
      </ProfileProvider>
    </SubscriptionProvider>
    </AuthProvider>
  );
}

// Layout component for authenticated app pages
function AppLayout({ children }: { children: React.ReactNode }) {
  const { isDesktop } = useResponsive();

  if (isDesktop) {
    return (
      <>
        <BackgroundJobIndicator />
        <DesktopLayout>
          {children}
        </DesktopLayout>
      </>
    );
  }

  // Mobile layout
  return (
    <>
      <BackgroundJobIndicator />
      <main style={styles.main}>
        {children}
      </main>
      <BottomTabNavigation />
    </>
  );
}

const styles = {
  main: {
    padding: '0',
    margin: '0',
    minHeight: '100vh',
    width: '100%',
    maxWidth: '100vw',
    overflow: 'hidden',
  }
};

export default App;
