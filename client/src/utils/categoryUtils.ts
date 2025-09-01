import type { Note } from '../types';

export type Category = 'gratitude' | 'experience' | 'reflection' | 'insight';

export interface CategoryInfo {
    name: string;
    color: string;
    backgroundColor: string;
}

export const categoryMap: Record<Category, CategoryInfo> = {
    gratitude: {
        name: 'gratitude',
        color: '#059669',
        backgroundColor: '#d1fae5',
    },
    experience: {
        name: 'experience',
        color: '#3b82f6',
        backgroundColor: '#dbeafe',
    },
    reflection: {
        name: 'reflection',
        color: '#7c3aed',
        backgroundColor: '#ede9fe',
    },
    insight: {
        name: 'insight',
        color: '#dc2626',
        backgroundColor: '#fee2e2',
    },
};

// Note: Categorization is now handled by AI in the backend
// This function is kept for backward compatibility with existing notes
export function categorizeNote(note: Note): Category {
    // Use AI-generated category if available, otherwise default to experience
    return note.category || 'experience';
}

export function getCategoryInfo(category: Category): CategoryInfo {
    return categoryMap[category];
}