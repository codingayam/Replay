import React from 'react';
import type { Category } from '../utils/categoryUtils';
import { getCategoryInfo } from '../utils/categoryUtils';

interface CategoryBadgeProps {
    category?: Category | Category[]; // Support both single category and array
    style?: React.CSSProperties;
}

const CategoryBadge: React.FC<CategoryBadgeProps> = ({ category, style = {} }) => {
    // Handle case where no category is provided
    if (!category) {
        return null;
    }
    
    // If it's a single category, wrap it in an array for consistent handling
    const categories = Array.isArray(category) ? category : [category];
    
    // If no categories, don't render anything
    if (categories.length === 0) {
        return null;
    }
    
    return (
        <div style={styles.container}>
            {categories.map((cat, index) => {
                const categoryInfo = getCategoryInfo(cat);
                return (
                    <span 
                        key={`${cat}-${index}`}
                        style={{
                            ...styles.badge,
                            color: categoryInfo.color,
                            backgroundColor: categoryInfo.backgroundColor,
                            ...style
                        }}
                    >
                        {categoryInfo.name}
                    </span>
                );
            })}
        </div>
    );
};

const styles = {
    container: {
        display: 'flex',
        gap: '0.5rem',
        flexWrap: 'wrap' as const,
    },
    badge: {
        display: 'inline-block',
        padding: '0.375rem 0.75rem',
        borderRadius: '12px',
        fontSize: '0.75rem',
        fontWeight: '500',
        fontFamily: 'var(--font-family)',
        textTransform: 'lowercase' as const,
        letterSpacing: '0.025em',
        border: '1px solid transparent',
        transition: 'all 0.2s ease',
    },
};

export default CategoryBadge;