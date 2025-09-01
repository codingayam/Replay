import React from 'react';
import { ChevronDown } from 'lucide-react';

interface RecentActivityCalendarProps {
    reflectionDates: string[];
    onExpandClick: () => void;
}

const RecentActivityCalendar: React.FC<RecentActivityCalendarProps> = ({ 
    reflectionDates, 
    onExpandClick 
}) => {
    // Get last 7 days from today
    const getLast7Days = () => {
        const days = [];
        const today = new Date();
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            days.push(date);
        }
        
        return days;
    };

    const hasReflection = (date: Date): boolean => {
        const dateString = date.toISOString().split('T')[0];
        return reflectionDates && reflectionDates.includes(dateString);
    };

    const formatDayName = (date: Date): string => {
        return date.toLocaleDateString('en-US', { weekday: 'short' }).substring(0, 1);
    };

    const formatDayNumber = (date: Date): string => {
        return date.getDate().toString();
    };

    const last7Days = getLast7Days();

    return (
        <div style={styles.container} onClick={onExpandClick}>
            <div style={styles.header}>
                <h3 style={styles.title}>Recent Activity</h3>
                <ChevronDown style={styles.expandIcon} />
            </div>
            <div style={styles.daysContainer}>
                {last7Days.map((day, index) => (
                    <div key={index} style={styles.dayColumn}>
                        <div style={styles.dayName}>
                            {formatDayName(day)}
                        </div>
                        <div style={{
                            ...styles.dayIndicator,
                            ...(hasReflection(day) ? styles.dayIndicatorActive : {})
                        }}>
                            <div style={hasReflection(day) ? styles.innerDot : {}} />
                        </div>
                        <div style={styles.dayNumber}>
                            {formatDayNumber(day)}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const styles = {
    container: {
        backgroundColor: '#f8fafc',
        borderRadius: '12px',
        padding: '16px',
        cursor: 'pointer',
        transition: 'background-color 0.2s ease',
        border: '1px solid #e2e8f0',
        marginBottom: '24px',
    } as React.CSSProperties,
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
    },
    title: {
        fontSize: '14px',
        fontWeight: '500',
        color: '#475569',
        margin: 0,
    },
    expandIcon: {
        width: '16px',
        height: '16px',
        color: '#94a3b8',
    },
    daysContainer: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dayColumn: {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        gap: '4px',
    },
    dayName: {
        fontSize: '12px',
        color: '#64748b',
        fontWeight: '500',
    },
    dayIndicator: {
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        backgroundColor: '#e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background-color 0.2s ease',
    },
    dayIndicatorActive: {
        backgroundColor: '#3b82f6',
    },
    innerDot: {
        width: '12px',
        height: '12px',
        backgroundColor: 'white',
        borderRadius: '50%',
    },
    dayNumber: {
        fontSize: '12px',
        color: '#64748b',
        fontWeight: '500',
    },
};

export default RecentActivityCalendar;