import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface CalendarModalProps {
    isOpen: boolean;
    onClose: () => void;
    reflectionDates: string[];
}

const CalendarModal: React.FC<CalendarModalProps> = ({ 
    isOpen, 
    onClose, 
    reflectionDates 
}) => {
    const [currentDate, setCurrentDate] = useState(new Date());

    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        const days = [];

        // Add empty cells for days before the first day of the month
        for (let i = 0; i < startingDayOfWeek; i++) {
            days.push(null);
        }

        // Add days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            days.push(day);
        }

        return days;
    };

    const hasReflection = (day: number | null): boolean => {
        if (!day) return false;
        const dateString = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return reflectionDates.includes(dateString);
    };

    const navigateMonth = (direction: 'prev' | 'next') => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            if (direction === 'prev') {
                newDate.setMonth(prev.getMonth() - 1);
            } else {
                newDate.setMonth(prev.getMonth() + 1);
            }
            return newDate;
        });
    };

    if (!isOpen) return null;

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div style={styles.header}>
                    <h2 style={styles.title}>Reflection Calendar</h2>
                    <button onClick={onClose} style={styles.closeButton}>
                        <X style={styles.closeIcon} />
                    </button>
                </div>

                <div style={styles.content}>
                    {/* Month Navigation */}
                    <div style={styles.monthNavigation}>
                        <button onClick={() => navigateMonth('prev')} style={styles.navButton}>
                            <ChevronLeft style={styles.navIcon} />
                        </button>
                        <h3 style={styles.monthTitle}>
                            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                        </h3>
                        <button onClick={() => navigateMonth('next')} style={styles.navButton}>
                            <ChevronRight style={styles.navIcon} />
                        </button>
                    </div>

                    {/* Calendar Grid */}
                    <div style={styles.calendarGrid}>
                        {/* Day headers */}
                        {daysOfWeek.map(day => (
                            <div key={day} style={styles.dayHeader}>
                                {day}
                            </div>
                        ))}

                        {/* Calendar days */}
                        {getDaysInMonth(currentDate).map((day, index) => (
                            <div key={index} style={styles.dayCell}>
                                {day && (
                                    <div style={{
                                        ...styles.dayNumber,
                                        ...(hasReflection(day) ? styles.dayNumberActive : {})
                                    }}>
                                        {day}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Legend */}
                    <div style={styles.legend}>
                        <div style={styles.legendItem}>
                            <div style={styles.legendDot} />
                            <span style={styles.legendText}>Reflection day</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const styles = {
    overlay: {
        position: 'fixed' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
    },
    modal: {
        backgroundColor: 'white',
        borderRadius: '16px',
        maxWidth: '400px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'hidden',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 24px 16px 24px',
        borderBottom: '1px solid #e2e8f0',
    },
    title: {
        fontSize: '18px',
        fontWeight: '600',
        color: '#0f172a',
        margin: 0,
    },
    closeButton: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '4px',
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background-color 0.2s ease',
    },
    closeIcon: {
        width: '20px',
        height: '20px',
        color: '#64748b',
    },
    content: {
        padding: '20px 24px 24px 24px',
    },
    monthNavigation: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px',
    },
    navButton: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '8px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background-color 0.2s ease',
    },
    navIcon: {
        width: '16px',
        height: '16px',
        color: '#64748b',
    },
    monthTitle: {
        fontSize: '16px',
        fontWeight: '500',
        color: '#0f172a',
        margin: 0,
    },
    calendarGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '4px',
        marginBottom: '20px',
    },
    dayHeader: {
        textAlign: 'center' as const,
        fontSize: '12px',
        fontWeight: '500',
        color: '#64748b',
        padding: '8px 0',
    },
    dayCell: {
        aspectRatio: '1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    dayNumber: {
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '14px',
        color: '#475569',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
    },
    dayNumberActive: {
        backgroundColor: '#3b82f6',
        color: 'white',
        fontWeight: '500',
    },
    legend: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: '16px',
        borderTop: '1px solid #e2e8f0',
    },
    legendItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    legendDot: {
        width: '16px',
        height: '16px',
        backgroundColor: '#3b82f6',
        borderRadius: '50%',
    },
    legendText: {
        fontSize: '14px',
        color: '#64748b',
    },
};

export default CalendarModal;