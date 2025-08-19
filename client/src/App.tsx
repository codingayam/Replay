import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import ExperiencesPage from './pages/ExperiencesPage';
import ReflectionsPage from './pages/ReflectionsPage';
import ProfilePage from './pages/ProfilePage';
import BottomTabNavigation from './components/BottomTabNavigation';
import Header from './components/Header';

function App() {
  return (
    <Router>
        <Header />
        <main style={styles.main}>
            <Routes>
                <Route path="/" element={<ExperiencesPage />} />
                <Route path="/reflections" element={<ReflectionsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
            </Routes>
        </main>
        <BottomTabNavigation />
    </Router>
  );
}

const styles = {
    main: {
        padding: '1rem',
        maxWidth: '800px',
        margin: '0 auto',
        minHeight: '100vh',
        paddingTop: '0', // Header is now outside
        paddingBottom: '100px', // Space for bottom navigation
    }
};

export default App;