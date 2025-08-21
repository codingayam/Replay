import React from 'react';

const Header: React.FC = () => {
  return (
    <header style={styles.header}>
      <div style={styles.leftSection}>
        <div>
          <h1 style={styles.appName}>Replay</h1>
          <p style={styles.subtitle}>Your daily reflections</p>
        </div>
      </div>
    </header>
  );
};

const styles = {
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: '1.25rem',
    backgroundColor: 'var(--card-background)',
    borderBottom: '1px solid var(--card-border)',
    position: 'sticky' as const,
    top: 0,
    left: 0,
    right: 0,
    width: '100%',
    zIndex: 100,
    minHeight: '72px',
    boxSizing: 'border-box' as const,
    backdropFilter: 'blur(10px)',
  },
  leftSection: {
    display: 'flex',
    alignItems: 'center',
  },
  appName: {
    fontSize: '1.75rem',
    fontWeight: '700',
    color: 'var(--text-color)',
    margin: 0,
    fontFamily: 'var(--font-family-heading)',
    letterSpacing: '-0.025em',
  },
  subtitle: {
    fontSize: '0.9rem',
    fontWeight: '400',
    color: 'var(--text-secondary)',
    margin: '0.25rem 0 0 0',
    fontFamily: 'var(--font-family)',
  },
};

export default Header;