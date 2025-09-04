import type { Note } from '../types';

export type Category = 'ideas' | 'feelings';

export interface CategoryInfo {
    name: string;
    color: string;
    backgroundColor: string;
}

export const categoryMap: Record<Category, CategoryInfo> = {
    ideas: {
        name: 'ideas',
        color: '#7c3aed',
        backgroundColor: '#ede9fe',
    },
    feelings: {
        name: 'feelings',
        color: '#059669',
        backgroundColor: '#d1fae5',
    },
};

// Get categories from note, handling both old single category format and new array format
export function getNoteCategories(note: Note): Category[] {
    return note.category || [];
}

// Check if note has a specific category
export function noteHasCategory(note: Note, category: Category): boolean {
    const categories = getNoteCategories(note);
    return categories.includes(category);
}

// Get category info for a specific category
export function getCategoryInfo(category: Category): CategoryInfo {
    return categoryMap[category];
}

// Get all category info objects for a note's categories
export function getNoteCategoryInfos(note: Note): CategoryInfo[] {
    const categories = getNoteCategories(note);
    return categories.map(category => getCategoryInfo(category));
}