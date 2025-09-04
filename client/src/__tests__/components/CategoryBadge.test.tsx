import React from 'react';
import { render, screen } from '@testing-library/react';
import CategoryBadge from '../../components/CategoryBadge';
import { categoryTestCases } from '../utils/testFactories';
import type { Category } from '../../utils/categoryUtils';

describe('CategoryBadge', () => {
  describe('Single category rendering', () => {
    test('renders single ideas category correctly', () => {
      render(<CategoryBadge category="ideas" />);
      
      const badge = screen.getByText('ideas');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveStyle({
        color: '#7c3aed',
        backgroundColor: '#ede9fe'
      });
    });

    test('renders single feelings category correctly', () => {
      render(<CategoryBadge category="feelings" />);
      
      const badge = screen.getByText('feelings');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveStyle({
        color: '#059669',
        backgroundColor: '#d1fae5'
      });
    });
  });

  describe('Multiple categories rendering', () => {
    test('renders array of categories with proper spacing', () => {
      render(<CategoryBadge category={['ideas', 'feelings']} />);
      
      const ideasBadge = screen.getByText('ideas');
      const feelingsBadge = screen.getByText('feelings');
      
      expect(ideasBadge).toBeInTheDocument();
      expect(feelingsBadge).toBeInTheDocument();
      
      // Check that they're in a flex container with gap
      const container = ideasBadge.closest('div');
      expect(container).toHaveStyle({
        display: 'flex',
        gap: '0.5rem',
        flexWrap: 'wrap'
      });
    });

    test('renders single item array correctly', () => {
      render(<CategoryBadge category={['ideas']} />);
      
      const badge = screen.getByText('ideas');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveStyle({
        color: '#7c3aed',
        backgroundColor: '#ede9fe'
      });
    });

    test('renders multiple instances of same category', () => {
      render(<CategoryBadge category={['ideas', 'ideas']} />);
      
      const badges = screen.getAllByText('ideas');
      expect(badges).toHaveLength(2);
      
      badges.forEach(badge => {
        expect(badge).toHaveStyle({
          color: '#7c3aed',
          backgroundColor: '#ede9fe'
        });
      });
    });
  });

  describe('Empty/null category handling', () => {
    test('returns null for undefined category', () => {
      const { container } = render(<CategoryBadge category={undefined} />);
      expect(container.firstChild).toBeNull();
    });

    test('returns null for null category', () => {
      const { container } = render(<CategoryBadge category={null as any} />);
      expect(container.firstChild).toBeNull();
    });

    test('returns null for empty array', () => {
      const { container } = render(<CategoryBadge category={[]} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Styling and props', () => {
    test('applies custom styles correctly', () => {
      const customStyle = {
        fontSize: '14px',
        fontWeight: 'bold'
      };
      
      render(<CategoryBadge category="ideas" style={customStyle} />);
      
      const badge = screen.getByText('ideas');
      expect(badge).toHaveStyle({
        fontSize: '14px',
        fontWeight: 'bold',
        // Should also maintain default styles
        color: '#7c3aed',
        backgroundColor: '#ede9fe'
      });
    });

    test('applies default badge styles', () => {
      render(<CategoryBadge category="ideas" />);
      
      const badge = screen.getByText('ideas');
      expect(badge).toHaveStyle({
        display: 'inline-block',
        padding: '0.375rem 0.75rem',
        borderRadius: '12px',
        fontSize: '0.75rem',
        fontWeight: '500',
        textTransform: 'lowercase',
        letterSpacing: '0.025em',
        border: '1px solid transparent',
        transition: 'all 0.2s ease'
      });
    });

    test('custom styles override defaults', () => {
      const customStyle = {
        backgroundColor: '#ff0000',
        color: '#ffffff'
      };
      
      render(<CategoryBadge category="ideas" style={customStyle} />);
      
      const badge = screen.getByText('ideas');
      expect(badge).toHaveStyle({
        backgroundColor: '#ff0000',
        color: '#ffffff'
      });
    });
  });

  describe('Accessibility', () => {
    test('badge elements are accessible', () => {
      render(<CategoryBadge category={['ideas', 'feelings']} />);
      
      const badges = screen.getAllByText(/ideas|feelings/);
      badges.forEach(badge => {
        expect(badge.tagName).toBe('SPAN');
      });
    });

    test('maintains proper text content', () => {
      render(<CategoryBadge category={['ideas', 'feelings']} />);
      
      expect(screen.getByText('ideas')).toBeInTheDocument();
      expect(screen.getByText('feelings')).toBeInTheDocument();
    });
  });

  describe('Dynamic test cases', () => {
    categoryTestCases.forEach((testCase) => {
      const description = Array.isArray(testCase.input) 
        ? `handles ${JSON.stringify(testCase.input)} correctly`
        : `handles ${testCase.input} correctly`;

      test(description, () => {
        const { container } = render(<CategoryBadge category={testCase.input as any} />);
        
        if (testCase.expected === 0) {
          expect(container.firstChild).toBeNull();
        } else {
          const badges = container.querySelectorAll('span');
          expect(badges).toHaveLength(testCase.expected);
          
          if (testCase.colors) {
            badges.forEach((badge, index) => {
              expect(badge).toHaveStyle({
                color: testCase.colors![index],
                backgroundColor: testCase.backgroundColors![index]
              });
              expect(badge).toHaveTextContent(testCase.names![index]);
            });
          } else if (testCase.color) {
            expect(badges[0]).toHaveStyle({
              color: testCase.color,
              backgroundColor: testCase.backgroundColor
            });
            expect(badges[0]).toHaveTextContent(testCase.name!);
          }
        }
      });
    });
  });

  describe('Error handling', () => {
    test('handles invalid category gracefully', () => {
      // This should be handled by TypeScript, but test runtime behavior
      const invalidCategory = 'invalid' as Category;
      
      expect(() => {
        render(<CategoryBadge category={invalidCategory} />);
      }).not.toThrow();
    });

    test('handles mixed valid/invalid categories', () => {
      const mixedCategories = ['ideas', 'invalid', 'feelings'] as Category[];
      
      expect(() => {
        render(<CategoryBadge category={mixedCategories} />);
      }).not.toThrow();
      
      // Should still render valid categories
      expect(screen.getByText('ideas')).toBeInTheDocument();
      expect(screen.getByText('feelings')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    test('renders efficiently with many categories', () => {
      const manyCategories = Array(50).fill('ideas') as Category[];
      
      const start = performance.now();
      render(<CategoryBadge category={manyCategories} />);
      const end = performance.now();
      
      expect(end - start).toBeLessThan(50); // Should render in less than 50ms
      expect(screen.getAllByText('ideas')).toHaveLength(50);
    });
  });
});