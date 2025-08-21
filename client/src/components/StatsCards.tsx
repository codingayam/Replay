import React from 'react';
import { Flame, Target } from 'lucide-react';

interface StatsCardsProps {
    streak: number;
    monthlyCount: number;
}

const StatsCards: React.FC<StatsCardsProps> = ({ streak, monthlyCount }) => {
    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <div style={styles.iconContainer}>
                    <Flame style={styles.icon} />
                </div>
                <div style={styles.content}>
                    <div style={styles.number}>{streak}</div>
                    <div style={styles.label}>Day Streak</div>
                </div>
            </div>
            
            <div style={styles.card}>
                <div style={styles.iconContainer}>
                    <Target style={styles.icon} />
                </div>
                <div style={styles.content}>
                    <div style={styles.number}>{monthlyCount}</div>
                    <div style={styles.label}>This Month</div>
                </div>
            </div>
        </div>
    );
};

const styles = {
    container: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px',
        marginBottom: '24px',
    },
    card: {
        backgroundColor: '#f8fafc',
        borderRadius: '12px',
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        border: '1px solid #e2e8f0',
    },
    iconContainer: {
        width: '40px',
        height: '40px',
        backgroundColor: '#e0f2fe',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    icon: {
        width: '20px',
        height: '20px',
        color: '#0284c7',
    },
    content: {
        flex: 1,
    },
    number: {
        fontSize: '24px',
        fontWeight: '600',
        color: '#0f172a',
        lineHeight: 1,
        marginBottom: '2px',
    },
    label: {
        fontSize: '12px',
        color: '#64748b',
        fontWeight: '500',
    },
};

export default StatsCards;