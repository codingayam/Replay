import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut } from 'lucide-react';

const Header: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  // For now, we'll use basic user info from Supabase auth
  // Later we can fetch user profile from our database
  useEffect(() => {
    if (user) {
      setUserProfile({
        email: user.email,
        firstName: user.user_metadata?.firstName || user.email?.split('@')[0],
        fullName: user.user_metadata?.fullName || user.email,
        avatarUrl: user.user_metadata?.avatarUrl
      });
    }
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    setShowUserMenu(false);
    navigate('/', { replace: true });
  };

  return (
    <header style={styles.header}>
      <div style={styles.leftSection}>
        <div>
          <h1 style={styles.appName}>Replay</h1>
          <p style={styles.subtitle}>
            {userProfile?.firstName ? `Welcome back, ${userProfile.firstName}` : 'Your daily reflections'}
          </p>
        </div>
      </div>
      
      {user && (
        <div style={styles.rightSection}>
          <div style={styles.userSection}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              style={styles.userButton}
            >
              {userProfile?.avatarUrl ? (
                <img 
                  src={userProfile.avatarUrl} 
                  alt="Profile" 
                  style={styles.userAvatar}
                />
              ) : (
                <div style={styles.userInitials}>
                  {userProfile?.firstName?.[0] || userProfile?.email?.[0] || 'U'}
                </div>
              )}
            </button>
            
            {showUserMenu && (
              <div style={styles.userMenu}>
                <div style={styles.userInfo}>
                  <div style={styles.userName}>
                    {userProfile?.fullName || userProfile?.email}
                  </div>
                  <div style={styles.userEmail}>
                    {userProfile?.email}
                  </div>
                </div>
                <hr style={styles.menuDivider} />
                <button onClick={handleSignOut} style={styles.menuItem}>
                  <LogOut size={16} />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

const styles = {
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  rightSection: {
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
  userSection: {
    position: 'relative' as const,
  },
  userButton: {
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    objectFit: 'cover' as const,
  },
  userInitials: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#4F46E5',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    fontWeight: '600',
    textTransform: 'uppercase' as const,
  },
  userMenu: {
    position: 'absolute' as const,
    top: '50px',
    right: 0,
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
    border: '1px solid var(--card-border)',
    padding: '12px',
    minWidth: '200px',
    zIndex: 1000,
  },
  userInfo: {
    padding: '8px 0',
  },
  userName: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--text-color)',
    marginBottom: '4px',
  },
  userEmail: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
  },
  menuDivider: {
    border: 'none',
    borderTop: '1px solid var(--card-border)',
    margin: '8px 0',
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '8px 12px',
    background: 'none',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    color: 'var(--text-color)',
    transition: 'background-color 0.2s',
    '&:hover': {
      backgroundColor: 'var(--hover-background)',
    },
  },
};

export default Header;