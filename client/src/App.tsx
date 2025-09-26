import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider, SignedIn, SignedOut } from './contexts/AuthContext';
import { JobProvider } from './contexts/JobContext';
import ExperiencesPage from './pages/ExperiencesPage';
import ReflectionsPage from './pages/ReflectionsPage';
import ProfilePage from './pages/ProfilePage';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import OnboardingPage from './pages/OnboardingPage';
import EmailConfirmationPage from './pages/EmailConfirmationPage';
import BottomTabNavigation from './components/BottomTabNavigation';
import DesktopLayout from './components/DesktopLayout';
import BackgroundJobIndicator from './components/BackgroundJobIndicator';
import { useResponsive } from './hooks/useResponsive';
import AuthCallbackPage from './pages/AuthCallbackPage';

function App() {
  return (
    <AuthProvider>
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
                <OnboardingPage />
              </SignedIn>
            } 
          />
          <Route 
            path="/experiences" 
            element={
              <SignedIn>
                <AppLayout>
                  <ExperiencesPage />
                </AppLayout>
              </SignedIn>
            } 
          />
          <Route 
            path="/reflections" 
            element={
              <SignedIn>
                <AppLayout>
                  <ReflectionsPage />
                </AppLayout>
              </SignedIn>
            } 
          />
          <Route
            path="/profile"
            element={
              <SignedIn>
                <AppLayout>
                  <ProfilePage />
                </AppLayout>
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
  }
};

export default App;
