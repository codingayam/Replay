import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider, SignedIn, SignedOut } from './contexts/AuthContext';
import ExperiencesPage from './pages/ExperiencesPage';
import ReflectionsPage from './pages/ReflectionsPage';
import ProfilePage from './pages/ProfilePage';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import OnboardingPage from './pages/OnboardingPage';
import Header from './components/Header';
import BottomTabNavigation from './components/BottomTabNavigation';

function App() {
  return (
    <AuthProvider>
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
    </AuthProvider>
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