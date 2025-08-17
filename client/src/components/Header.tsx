import React from 'react';

const Header: React.FC = () => {
  return (
    <header style={styles.header}>
      <div style={styles.leftSection}>
        <h1 style={styles.appName}>Replay</h1>
      </div>
    </header>
  );
};

const styles = {
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.75rem 1rem',
    backgroundColor: 'white',
    borderBottom: '1px solid #dbdbdb',
    position: 'sticky' as const,
    top: 0,
    zIndex: 100,
    height: '60px',
    boxSizing: 'border-box' as const,
  },
  leftSection: {
    display: 'flex',
    alignItems: 'center',
  },
  appName: {
    fontSize: '1.5rem',
    fontWeight: '600',
    color: '#262626',
    margin: 0,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
};

export default Header;