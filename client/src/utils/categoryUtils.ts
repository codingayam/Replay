import type { Note } from '../types';

export type Category = 'experience' | 'knowledge' | 'book';

export interface CategoryInfo {
    name: string;
    color: string;
    backgroundColor: string;
}

export const categoryMap: Record<Category, CategoryInfo> = {
    experience: {
        name: 'experience',
        color: 'var(--experience-color)',
        backgroundColor: 'var(--experience-bg)',
    },
    knowledge: {
        name: 'knowledge',
        color: 'var(--knowledge-color)',
        backgroundColor: 'var(--knowledge-bg)',
    },
    book: {
        name: 'book',
        color: 'var(--book-color)',
        backgroundColor: 'var(--book-bg)',
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