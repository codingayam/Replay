import React, { useMemo } from 'react';
import { ChevronDown } from 'lucide-react';

interface RecentActivityCalendarProps {
  journalDates: string[];
  reflectionDates: string[];
  onExpandClick: () => void;
}

const journalColor = '#3b82f6';
const reflectionColor = '#8b5cf6';

const RecentActivityCalendar: React.FC<RecentActivityCalendarProps> = ({
  journalDates,
  reflectionDates,
  onExpandClick
}) => {
  const journalSet = useMemo(() => new Set(journalDates), [journalDates]);
  const reflectionSet = useMemo(() => new Set(reflectionDates), [reflectionDates]);

  const getLast7Days = () => {
    const days: Date[] = [];
    const today = new Date();

    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      days.push(date);
    }

    return days;
  };

  const getDayState = (date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    return {
      hasJournal: journalSet.has(dateString),
      hasReflection: reflectionSet.has(dateString)
    };
  };

  const formatDayName = (date: Date): string => (
    date.toLocaleDateString('en-US', { weekday: 'short' }).substring(0, 1)
  );

  const formatDayNumber = (date: Date): string => date.getDate().toString();

  const last7Days = getLast7Days();

  return (
    <div style={styles.container} onClick={onExpandClick}>
      <div style={styles.header}>
        <h3 style={styles.title}>Recent Activity</h3>
        <ChevronDown style={styles.expandIcon} />
      </div>
      <div style={styles.daysContainer}>
        {last7Days.map((day) => {
          const { hasJournal, hasReflection } = getDayState(day);

          const indicatorStyle: React.CSSProperties = {
            ...styles.dayIndicator,
            ...(hasJournal && hasReflection ? styles.dayIndicatorBoth : {}),
            ...(hasJournal && !hasReflection ? styles.dayIndicatorJournal : {}),
            ...(hasReflection && !hasJournal ? styles.dayIndicatorReflection : {})
          };

          const dayNumberStyle: React.CSSProperties = {
            ...styles.dayNumber,
            ...(hasJournal ? styles.dayNumberJournal : {}),
            ...(hasReflection ? styles.dayNumberReflection : {}),
            ...(hasJournal && hasReflection ? styles.dayNumberBoth : {})
          };

          let innerDot: React.ReactNode = null;
          if (hasJournal && hasReflection) {
            innerDot = <div style={styles.innerDotBoth} />;
          } else if (hasReflection) {
            innerDot = <div style={styles.innerDotReflection} />;
          }

          return (
            <div key={day.toISOString()} style={styles.dayColumn}>
              <div style={styles.dayName}>
                {formatDayName(day)}
              </div>
              <div style={indicatorStyle}>
                {innerDot}
              </div>
              <div style={dayNumberStyle}>
                {formatDayNumber(day)}
              </div>
            </div>
          );
        })}
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
    marginBottom: '24px'
  } as React.CSSProperties,
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px'
  } as React.CSSProperties,
  title: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#475569',
    margin: 0
  } as React.CSSProperties,
  expandIcon: {
    width: '16px',
    height: '16px',
    color: '#94a3b8'
  } as React.CSSProperties,
  daysContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  } as React.CSSProperties,
  dayColumn: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '4px'
  } as React.CSSProperties,
  dayName: {
    fontSize: '12px',
    color: '#64748b',
    fontWeight: 500
  } as React.CSSProperties,
  dayIndicator: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: '#e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s ease, border 0.2s ease'
  } as React.CSSProperties,
  dayIndicatorJournal: {
    backgroundColor: journalColor
  } as React.CSSProperties,
  dayIndicatorReflection: {
    backgroundColor: reflectionColor
  } as React.CSSProperties,
  dayIndicatorBoth: {
    backgroundColor: reflectionColor
  } as React.CSSProperties,
  innerDotReflection: {
    width: '10px',
    height: '10px',
    backgroundColor: '#ffffff',
    borderRadius: '50%'
  } as React.CSSProperties,
  innerDotBoth: {
    width: '12px',
    height: '12px',
    backgroundColor: journalColor,
    borderRadius: '50%'
  } as React.CSSProperties,
  dayNumber: {
    fontSize: '12px',
    color: '#64748b',
    fontWeight: 500
  } as React.CSSProperties,
  dayNumberJournal: {
    color: journalColor,
    fontWeight: 600
  } as React.CSSProperties,
  dayNumberReflection: {
    color: reflectionColor,
    fontWeight: 600
  } as React.CSSProperties,
  dayNumberBoth: {
    color: reflectionColor,
    fontWeight: 700
  } as React.CSSProperties
};

export default RecentActivityCalendar;
