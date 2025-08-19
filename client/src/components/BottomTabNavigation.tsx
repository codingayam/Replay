import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Calendar, Brain, User } from 'lucide-react';

const BottomTabNavigation: React.FC = () => {
    const location = useLocation();

    const tabs = [
        { path: '/', icon: Calendar, label: 'Experiences' },
        { path: '/reflections', icon: Brain, label: 'Reflections' },
        { path: '/profile', icon: User, label: 'Profile' },
    ];

    return (
        <nav style={styles.navigation}>
            {tabs.map((tab) => {
                const isActive = location.pathname === tab.path;
                const Icon = tab.icon;
                
                return (
                    <Link 
                        key={tab.path} 
                        to={tab.path} 
                        style={{
                            ...styles.tab,
                            ...(isActive ? styles.activeTab : styles.inactiveTab)
                        }}
                    >
                        <Icon size={24} />
                        <span style={styles.label}>{tab.label}</span>
                    </Link>
                );
            })}
        </nav>
    );
};

const styles = {
    navigation: {
        position: 'fixed' as const,
        bottom: 0,
        left: 0,
        right: 0,
        height: '88px',
        backgroundColor: 'var(--card-background)',
        borderTop: '1px solid var(--card-border)',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        padding: '0 2rem',
        zIndex: 1000,
        boxShadow: 'var(--shadow-lg)',
        backdropFilter: 'blur(10px)',
    },
    tab: {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
        textDecoration: 'none',
        padding: '0.75rem 1rem',
        borderRadius: 'var(--border-radius-sm)',
        minWidth: '72px',
        transition: 'all 0.2s ease',
    },
    activeTab: {
        color: 'var(--primary-color)',
        backgroundColor: 'var(--primary-lighter)',
    },
    inactiveTab: {
        color: 'var(--text-tertiary)',
    },
    label: {
        fontSize: '0.75rem',
        marginTop: '0.375rem',
        fontWeight: '500',
        fontFamily: 'var(--font-family)',
    },
};

export default BottomTabNavigation;