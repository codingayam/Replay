import React from 'react';
import DesktopSidebar from './DesktopSidebar';

interface DesktopLayoutProps {
  children: React.ReactNode;
}

const DesktopLayout: React.FC<DesktopLayoutProps> = ({ children }) => {
  return (
    <div style={styles.container}>
      <DesktopSidebar />
      <main style={styles.mainContent}>
        {children}
      </main>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#f8f9ff',
  },
  mainContent: {
    flex: 1,
    marginLeft: '360px', // Same as sidebar width
    padding: '2rem',
    minHeight: '100vh',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: '20px',
    borderBottomLeftRadius: '20px',
    marginTop: '1rem',
    marginBottom: '1rem',
    marginRight: '1rem',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    overflowY: 'auto' as const,
    position: 'relative' as const,
  },
};

export default DesktopLayout;