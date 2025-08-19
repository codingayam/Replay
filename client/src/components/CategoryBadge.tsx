import React from 'react';
import type { Category } from '../utils/categoryUtils';
import { getCategoryInfo } from '../utils/categoryUtils';

interface CategoryBadgeProps {
    category: Category;
    style?: React.CSSProperties;
}

const CategoryBadge: React.FC<CategoryBadgeProps> = ({ category, style = {} }) => {
    const categoryInfo = getCategoryInfo(category);
    
    return (
        <span 
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
};

const styles = {
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