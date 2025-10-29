import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  journalDates: string[];
  reflectionDates: string[];
}

const journalColor = '#4adede';
const reflectionColor = '#8b5cf6';

const CalendarModal: React.FC<CalendarModalProps> = ({
  isOpen,
  onClose,
  journalDates,
  reflectionDates
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    if (isOpen) {
      setCurrentDate(new Date());
    }
  }, [isOpen]);

  const journalSet = useMemo(() => new Set(journalDates), [journalDates]);
  const reflectionSet = useMemo(() => new Set(reflectionDates), [reflectionDates]);

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

    const days: Array<number | null> = [];

    for (let i = 0; i < startingDayOfWeek; i += 1) {
      days.push(null);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      days.push(day);
    }

    return days;
  };

  const getDateString = (day: number) => (
    `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  );

  const getDayState = (day: number | null) => {
    if (!day) {
      return { hasJournal: false, hasReflection: false };
    }
    const key = getDateString(day);
    return {
      hasJournal: journalSet.has(key),
      hasReflection: reflectionSet.has(key)
    };
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate((prev) => {
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
          <h2 style={styles.title}>Mindfulness Calendar</h2>
          <button onClick={onClose} style={styles.closeButton}>
            <X style={styles.closeIcon} />
          </button>
        </div>

        <div style={styles.content}>
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

          <div style={styles.calendarGrid}>
            {daysOfWeek.map((day) => (
              <div key={day} style={styles.dayHeader}>
                {day}
              </div>
            ))}

            {getDaysInMonth(currentDate).map((day, index) => {
              const { hasJournal, hasReflection } = getDayState(day);

              let dayContent: React.ReactNode = null;
              if (day) {
                if (hasJournal && hasReflection) {
                  dayContent = (
                    <div style={styles.daySplit}>
                      <span style={styles.dayNumberActive}>{day}</span>
                    </div>
                  );
                } else if (hasJournal || hasReflection) {
                  dayContent = (
                    <div
                      style={{
                        ...styles.dayBadge,
                        backgroundColor: hasReflection ? reflectionColor : journalColor
                      }}
                    >
                      <span style={styles.dayNumberActive}>{day}</span>
                    </div>
                  );
                } else {
                  dayContent = (
                    <div style={styles.dayNumberMuted}>{day}</div>
                  );
                }
              }

              return (
                <div key={`${index}-${day}`} style={styles.dayCell}>
                  {dayContent}
                </div>
              );
            })}
          </div>

          <div style={styles.legend}>
            <div style={styles.legendItem}>
              <div style={{ ...styles.legendSwatch, backgroundColor: journalColor }} />
              <span style={styles.legendText}>Journals</span>
            </div>
            <div style={styles.legendItem}>
              <div style={{ ...styles.legendSwatch, backgroundColor: reflectionColor }} />
              <span style={styles.legendText}>Meditations</span>
            </div>
            <div style={styles.legendItem}>
              <div style={styles.legendSplitCircle} />
              <span style={styles.legendText}>Both</span>
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
    padding: '20px'
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '16px',
    maxWidth: '400px',
    width: '100%',
    maxHeight: '90vh',
    overflow: 'hidden',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
  } as React.CSSProperties,
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px 16px 24px',
    borderBottom: '1px solid #e2e8f0'
  } as React.CSSProperties,
  title: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#0f172a',
    margin: 0
  } as React.CSSProperties,
  closeButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s ease'
  } as React.CSSProperties,
  closeIcon: {
    width: '20px',
    height: '20px',
    color: '#64748b'
  } as React.CSSProperties,
  content: {
    padding: '20px 24px 24px 24px'
  } as React.CSSProperties,
  monthNavigation: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '20px'
  } as React.CSSProperties,
  navButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '8px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s ease'
  } as React.CSSProperties,
  navIcon: {
    width: '18px',
    height: '18px',
    color: '#94a3b8'
  } as React.CSSProperties,
  monthTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#0f172a',
    margin: 0
  } as React.CSSProperties,
  calendarGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '12px',
    marginBottom: '24px'
  } as React.CSSProperties,
  dayHeader: {
    fontSize: '12px',
    textTransform: 'uppercase' as const,
    color: '#94a3b8',
    letterSpacing: '0.08em',
    fontWeight: 600,
    textAlign: 'center' as const
  } as React.CSSProperties,
  dayCell: {
    width: '100%',
    minHeight: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  } as React.CSSProperties,
  dayNumberMuted: {
    fontSize: '14px',
    color: '#94a3b8',
    textAlign: 'center' as const
  } as React.CSSProperties,
  dayNumberActive: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#0f172a'
  } as React.CSSProperties,
  dayBadge: {
    minWidth: '32px',
    minHeight: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  } as React.CSSProperties,
  daySplit: {
    minWidth: '36px',
    minHeight: '36px',
    borderRadius: '50%',
    background: `linear-gradient(to right, ${journalColor} 50%, ${reflectionColor} 50%)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  } as React.CSSProperties,
  legend: {
    display: 'flex',
    gap: '16px',
    alignItems: 'center'
  } as React.CSSProperties,
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  } as React.CSSProperties,
  legendSwatch: {
    width: '12px',
    height: '12px',
    borderRadius: '50%'
  } as React.CSSProperties,
  legendSplitCircle: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    background: `linear-gradient(to right, ${journalColor} 50%, ${reflectionColor} 50%)`
  } as React.CSSProperties,
  legendText: {
    fontSize: '12px',
    color: '#475569',
    fontWeight: 500
  } as React.CSSProperties
};

export default CalendarModal;
