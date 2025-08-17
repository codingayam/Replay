import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, Brain, User } from 'lucide-react';

const BottomTabNavigation: React.FC = () => {
    const location = useLocation();

    const tabs = [
        { path: '/', icon: BookOpen, label: 'Experiences' },
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
        height: '85px',
        backgroundColor: 'var(--card-background)',
        borderTop: '1px solid var(--card-border)',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        padding: '0 1rem',
        zIndex: 1000,
        boxShadow: 'var(--shadow-lg)',
    },
    tab: {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
        textDecoration: 'none',
        padding: '0.5rem',
        borderRadius: '8px',
        minWidth: '60px',
        transition: 'all 0.2s ease',
    },
    activeTab: {
        color: 'var(--primary-color)',
    },
    inactiveTab: {
        color: '#6c757d',
    },
    label: {
        fontSize: '0.75rem',
        marginTop: '0.25rem',
        fontWeight: '500',
    },
};

export default BottomTabNavigation;