import React from 'react';
import { Link } from 'react-router-dom';

const HomePage: React.FC = () => {
  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.logo}>Replay</div>
        <nav style={styles.nav}>
          <Link to="/login" style={styles.navLink}>Log in</Link>
          <Link to="/signup" style={{ ...styles.navLink, ...styles.ctaButton }}>Get Started</Link>
        </nav>
      </header>

      <main style={styles.main}>
        <section style={styles.hero}>
          <h1 style={styles.title}>Reflect, integrate, and grow in minutes a day.</h1>
          <p style={styles.subtitle}>
            Replay helps you capture the moments that matter, see your patterns clearly, and receive guided meditations tailored to your week.
          </p>
          <div style={styles.heroActions}>
            <Link to="/signup" style={{ ...styles.ctaButton, ...styles.primaryButton }}>Start free trial</Link>
            <Link to="/login" style={{ ...styles.ctaButton, ...styles.secondaryButton }}>View dashboard</Link>
          </div>
        </section>

        <section style={styles.features}>
          <div style={styles.featureCard}>
            <h2 style={styles.featureTitle}>Daily reflections</h2>
            <p style={styles.featureCopy}>Log voice notes or text entries in seconds and keep your streak alive.</p>
          </div>
          <div style={styles.featureCard}>
            <h2 style={styles.featureTitle}>Weekly insights</h2>
            <p style={styles.featureCopy}>Get an AI summary of your week and identify themes worth celebrating or adjusting.</p>
          </div>
          <div style={styles.featureCard}>
            <h2 style={styles.featureTitle}>Personal meditations</h2>
            <p style={styles.featureCopy}>Receive a fresh guided meditation generated from your own reflections every week.</p>
          </div>
        </section>
      </main>

      <footer style={styles.footer}>
        <p style={styles.footerCopy}>© {new Date().getFullYear()} Replay. Built for mindful growth.</p>
      </footer>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)',
    color: '#0f172a',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '24px 32px',
    maxWidth: '960px',
    margin: '0 auto',
    width: '100%',
  },
  logo: {
    fontWeight: 700,
    fontSize: '20px',
    letterSpacing: '-0.03em',
  },
  nav: {
    display: 'flex',
    gap: '16px',
  },
  navLink: {
    textDecoration: 'none',
    color: '#1e293b',
    fontWeight: 600,
    padding: '10px 18px',
    borderRadius: '999px',
    border: '1px solid transparent',
  },
  ctaButton: {
    border: '1px solid rgba(15, 23, 42, 0.2)',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    color: '#fff',
    border: 'none',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    color: '#1e293b',
  },
  main: {
    flex: 1,
    width: '100%',
  },
  hero: {
    maxWidth: '720px',
    margin: '80px auto 0 auto',
    textAlign: 'center',
    padding: '0 24px',
  },
  title: {
    fontSize: '48px',
    lineHeight: 1.1,
    marginBottom: '16px',
    fontWeight: 700,
    letterSpacing: '-0.025em',
  },
  subtitle: {
    fontSize: '18px',
    lineHeight: 1.6,
    color: '#475569',
    marginBottom: '32px',
  },
  heroActions: {
    display: 'flex',
    justifyContent: 'center',
    gap: '16px',
    flexWrap: 'wrap',
  },
  features: {
    display: 'grid',
    gap: '24px',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    maxWidth: '960px',
    margin: '96px auto',
    padding: '0 24px 80px 24px',
  },
  featureCard: {
    backgroundColor: '#fff',
    padding: '28px',
    borderRadius: '20px',
    boxShadow: '0 20px 45px rgba(15, 23, 42, 0.08)',
  },
  featureTitle: {
    fontSize: '20px',
    fontWeight: 700,
    marginBottom: '12px',
  },
  featureCopy: {
    fontSize: '15px',
    lineHeight: 1.6,
    color: '#475569',
  },
  footer: {
    textAlign: 'center',
    padding: '32px 24px',
    borderTop: '1px solid rgba(148, 163, 184, 0.2)',
  },
  footerCopy: {
    margin: 0,
    fontSize: '14px',
    color: '#64748b',
  },
};

export default HomePage;
