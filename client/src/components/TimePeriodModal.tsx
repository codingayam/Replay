import React, { useState, useEffect } from 'react';
import { X, Calendar } from 'lucide-react';

interface TimePeriodModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectDates: (startDate: string, endDate: string) => void;
}

const TimePeriodModal: React.FC<TimePeriodModalProps> = ({
    isOpen,
    onClose,
    onSelectDates,
}) => {
    // Helper function to format date in local timezone
    const getLocalDateString = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [startDate, setStartDate] = useState(() => {
        // Default to today in local timezone
        const today = new Date();
        return getLocalDateString(today);
    });
    
    const [endDate, setEndDate] = useState(() => {
        // Default to today in local timezone
        const today = new Date();
        return getLocalDateString(today);
    });

    // Reset dates to today whenever modal opens
    useEffect(() => {
        if (isOpen) {
            const today = new Date();
            const todayString = getLocalDateString(today);
            setStartDate(todayString);
            setEndDate(todayString);
        }
    }, [isOpen]);

    const handleStartDateChange = (date: string) => {
        setStartDate(date);
        // If end date is before start date, adjust it
        if (endDate < date) {
            setEndDate(date);
        }
    };

    const handleEndDateChange = (date: string) => {
        // Ensure end date is not before start date
        if (date >= startDate) {
            setEndDate(date);
        }
    };

    const handleContinue = () => {
        onSelectDates(startDate, endDate);
    };

    const getQuickSelectOptions = () => {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        const past3DaysStart = new Date(today);
        past3DaysStart.setDate(today.getDate() - 2); // 3 days ago (today + yesterday + 2 days ago)
        
        const past7DaysStart = new Date(today);
        past7DaysStart.setDate(today.getDate() - 6); // 7 days ago (today + 6 previous days)

        return [
            {
                label: 'Today',
                startDate: getLocalDateString(today),
                endDate: getLocalDateString(today),
            },
            {
                label: 'Yesterday',
                startDate: getLocalDateString(yesterday),
                endDate: getLocalDateString(yesterday),
            },
            {
                label: 'Past 3 Days',
                startDate: getLocalDateString(past3DaysStart),
                endDate: getLocalDateString(today),
            },
            {
                label: 'Past 7 Days',
                startDate: getLocalDateString(past7DaysStart),
                endDate: getLocalDateString(today),
            },
        ];
    };

    const quickOptions = getQuickSelectOptions();

    const handleQuickSelect = (option: { startDate: string; endDate: string }) => {
        setStartDate(option.startDate);
        setEndDate(option.endDate);
    };

    if (!isOpen) return null;

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div style={styles.header}>
                    <h2 style={styles.title}>Select Time Period</h2>
                    <button onClick={onClose} style={styles.closeButton}>
                        <X size={24} />
                    </button>
                </div>

                <div style={styles.content}>
                    <p style={styles.description}>
                        Choose which days you'd like to reflect on.
                    </p>

                    {/* Quick Select Options */}
                    <div style={styles.section}>
                        <h3 style={styles.sectionTitle}>Quick Select</h3>
                        <div style={styles.quickOptions}>
                            {quickOptions.map((option) => (
                                <button
                                    key={option.label}
                                    onClick={() => handleQuickSelect(option)}
                                    style={{
                                        ...styles.quickButton,
                                        ...(startDate === option.startDate && endDate === option.endDate
                                            ? styles.quickButtonActive
                                            : {})
                                    }}
                                >
                                    <Calendar size={16} />
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Custom Date Range */}
                    <div style={styles.section}>
                        <h3 style={styles.sectionTitle}>Custom Range</h3>
                        <div style={styles.dateInputs}>
                            <div style={styles.dateInput}>
                                <label style={styles.label}>From</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => handleStartDateChange(e.target.value)}
                                    style={styles.input}
                                    max={getLocalDateString(new Date())}
                                />
                            </div>
                            <div style={styles.dateInput}>
                                <label style={styles.label}>To</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => handleEndDateChange(e.target.value)}
                                    style={styles.input}
                                    min={startDate}
                                    max={getLocalDateString(new Date())}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div style={styles.footer}>
                    <button onClick={onClose} style={styles.cancelButton}>
                        Cancel
                    </button>
                    <button onClick={handleContinue} style={styles.continueButton}>
                        Continue
                    </button>
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
        padding: '1rem',
    },
    modal: {
        backgroundColor: 'var(--card-background)',
        borderRadius: 'var(--border-radius)',
        width: '100%',
        maxWidth: '480px',
        maxHeight: '90vh',
        overflowY: 'auto' as const,
        boxShadow: 'var(--shadow-lg)',
        border: '1px solid var(--card-border)',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1.5rem 1.5rem 1rem 1.5rem',
        borderBottom: '1px solid var(--card-border)',
    },
    title: {
        margin: 0,
        fontSize: '1.25rem',
        fontWeight: '600',
        color: 'var(--text-color)',
    },
    closeButton: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: 'var(--text-secondary)',
        padding: '0.25rem',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background-color 0.2s',
    },
    content: {
        padding: '1.5rem',
    },
    description: {
        margin: '0 0 1.5rem 0',
        color: 'var(--text-secondary)',
        fontSize: '0.9rem',
        lineHeight: 1.5,
    },
    section: {
        marginBottom: '2rem',
    },
    sectionTitle: {
        margin: '0 0 1rem 0',
        fontSize: '1rem',
        fontWeight: '600',
        color: 'var(--text-color)',
    },
    quickOptions: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: '0.75rem',
    },
    quickButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.75rem 1rem',
        border: '2px solid var(--card-border)',
        borderRadius: '8px',
        backgroundColor: 'transparent',
        color: 'var(--text-color)',
        cursor: 'pointer',
        fontSize: '0.9rem',
        fontWeight: '500',
        transition: 'all 0.2s',
        justifyContent: 'center',
    },
    quickButtonActive: {
        borderColor: 'var(--primary-color)',
        backgroundColor: 'var(--primary-color)',
        color: 'white',
    },
    dateInputs: {
        display: 'flex',
        gap: '1rem',
    },
    dateInput: {
        flex: 1,
    },
    label: {
        display: 'block',
        marginBottom: '0.5rem',
        fontSize: '0.9rem',
        fontWeight: '500',
        color: 'var(--text-color)',
    },
    input: {
        width: '100%',
        padding: '0.875rem',
        border: '2px solid var(--card-border)',
        borderRadius: '8px',
        fontSize: '1rem',
        backgroundColor: 'var(--input-background)',
        color: 'var(--text-color)',
        boxSizing: 'border-box' as const,
        transition: 'border-color 0.2s',
    },
    footer: {
        display: 'flex',
        gap: '0.75rem',
        padding: '1rem 1.5rem 1.5rem 1.5rem',
        borderTop: '1px solid var(--card-border)',
        justifyContent: 'flex-end',
    },
    cancelButton: {
        padding: '0.875rem 1.5rem',
        border: '2px solid var(--text-secondary)',
        borderRadius: '8px',
        backgroundColor: 'transparent',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        fontSize: '0.95rem',
        fontWeight: '500',
        transition: 'all 0.2s',
    },
    continueButton: {
        padding: '0.875rem 1.5rem',
        border: 'none',
        borderRadius: '8px',
        background: 'var(--gradient-primary)',
        color: 'white',
        cursor: 'pointer',
        fontSize: '0.95rem',
        fontWeight: '600',
        transition: 'all 0.2s',
    },
};

export default TimePeriodModal;
