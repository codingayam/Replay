import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import ExperiencesPage from './pages/ExperiencesPage';
import ReflectionsPage from './pages/ReflectionsPage';
import ProfilePage from './pages/ProfilePage';
import BottomTabNavigation from './components/BottomTabNavigation';

function App() {
  return (
    <Router>
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
        paddingBottom: '100px', // Space for bottom navigation
    }
};

export default App;