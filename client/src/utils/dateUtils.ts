import type { Note } from '../types';

export interface GroupedNotes {
    [key: string]: Note[];
}

export const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
};

export const isYesterday = (date: Date): boolean => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return date.toDateString() === yesterday.toDateString();
};

export const isThisWeek = (date: Date): boolean => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Start of this week (Sunday)
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // End of this week (Saturday)
    
    return date >= startOfWeek && date <= endOfWeek;
};

export const isLastWeek = (date: Date): boolean => {
    const today = new Date();
    const lastWeekStart = new Date(today);
    lastWeekStart.setDate(today.getDate() - today.getDay() - 7); // Start of last week
    
    const lastWeekEnd = new Date(lastWeekStart);
    lastWeekEnd.setDate(lastWeekStart.getDate() + 6); // End of last week
    
    return date >= lastWeekStart && date <= lastWeekEnd;
};

export const isThisMonth = (date: Date): boolean => {
    const today = new Date();
    return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
};

export const isLastMonth = (date: Date): boolean => {
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1);
    return date.getMonth() === lastMonth.getMonth() && date.getFullYear() === lastMonth.getFullYear();
};

export const isThisYear = (date: Date): boolean => {
    const today = new Date();
    return date.getFullYear() === today.getFullYear();
};

export const isLastYear = (date: Date): boolean => {
    const today = new Date();
    return date.getFullYear() === today.getFullYear() - 1;
};

export const formatDateHeader = (date: Date): string => {
    if (isToday(date)) {
        return 'Today';
    }
    
    if (isYesterday(date)) {
        return 'Yesterday';
    }
    
    // For dates within this week, show day name (e.g., "Monday", "Tuesday")
    if (isThisWeek(date)) {
        return date.toLocaleDateString('en-US', { weekday: 'long' });
    }
    
    // For dates in last week
    if (isLastWeek(date)) {
        return 'Last Week';
    }
    
    // For dates in this month (but not this week)
    if (isThisMonth(date)) {
        return 'Earlier This Month';
    }
    
    // For dates in last month
    if (isLastMonth(date)) {
        return 'Last Month';
    }
    
    // For dates in this year (but not this month)
    if (isThisYear(date)) {
        return date.toLocaleDateString('en-US', { month: 'long' });
    }
    
    // For dates in last year
    if (isLastYear(date)) {
        return 'Last Year';
    }
    
    // For older dates, show the year
    return date.getFullYear().toString();
};

export const groupNotesByDate = (notes: Note[]): GroupedNotes => {
    const grouped: GroupedNotes = {};
    
    notes.forEach(note => {
        const noteDate = new Date(note.date);
        const dateHeader = formatDateHeader(noteDate);
        
        if (!grouped[dateHeader]) {
            grouped[dateHeader] = [];
        }
        
        grouped[dateHeader].push(note);
    });
    
    return grouped;
};

export const getDateGroupOrder = (dateHeader: string): number => {
    // Define sorting order for date groups
    switch (dateHeader) {
        case 'Today':
            return 0;
        case 'Yesterday':
            return 1;
        case 'Monday':
        case 'Tuesday':
        case 'Wednesday':
        case 'Thursday':
        case 'Friday':
        case 'Saturday':
        case 'Sunday':
            return 2; // This week days
        case 'Last Week':
            return 3;
        case 'Earlier This Month':
            return 4;
        case 'Last Month':
            return 5;
        case 'January':
        case 'February':
        case 'March':
        case 'April':
        case 'May':
        case 'June':
        case 'July':
        case 'August':
        case 'September':
        case 'October':
        case 'November':
        case 'December':
            return 6; // This year months
        case 'Last Year':
            return 7;
        default:
            return 8; // Older years
    }
};

export const sortDateGroups = (dateHeaders: string[]): string[] => {
    const monthOrder = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
    
    return dateHeaders.sort((a, b) => {
        const orderA = getDateGroupOrder(a);
        const orderB = getDateGroupOrder(b);
        
        if (orderA !== orderB) {
            return orderA - orderB;
        }
        
        // For same category, handle special sorting
        if (orderA === 6) { // Both are months in this year
            const monthIndexA = monthOrder.indexOf(a);
            const monthIndexB = monthOrder.indexOf(b);
            return monthIndexB - monthIndexA; // Most recent month first
        }
        
        if (orderA === 8) { // Both are older years
            const yearA = parseInt(a);
            const yearB = parseInt(b);
            return yearB - yearA; // Most recent year first
        }
        
        return 0;
    });
};