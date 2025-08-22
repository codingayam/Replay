import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { ClerkProvider, SignedIn, SignedOut } from '@clerk/clerk-react';
import ExperiencesPage from './pages/ExperiencesPage';
import ReflectionsPage from './pages/ReflectionsPage';
import ProfilePage from './pages/ProfilePage';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import OnboardingPage from './pages/OnboardingPage';
import Header from './components/Header';
import BottomTabNavigation from './components/BottomTabNavigation';

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error("Missing Clerk Publishable Key");
}

function App() {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <Router>
        <Routes>
          {/* Public Routes - Authentication */}
          <Route 
            path="/login" 
            element={
              <SignedOut>
                <LoginPage />
              </SignedOut>
            } 
          />
          <Route 
            path="/signup" 
            element={
              <SignedOut>
                <SignUpPage />
              </SignedOut>
            } 
          />
          
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
    </ClerkProvider>
  );
}

// Layout component for authenticated app pages
function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main style={styles.main}>
        {children}
      </main>
      <BottomTabNavigation />
    </>
  );
}

const styles = {
  main: {
    padding: '1rem',
    maxWidth: '800px',
    margin: '0 auto',
    minHeight: '100vh',
    paddingTop: '0',
    paddingBottom: '100px', // Space for bottom navigation
  }
};

export default App;