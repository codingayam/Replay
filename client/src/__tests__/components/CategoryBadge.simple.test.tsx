import React from 'react';
import { render } from '@testing-library/react';
import CategoryBadge from '../../components/CategoryBadge';

describe('CategoryBadge Basic Tests', () => {
  test('renders without crashing', () => {
    const { container } = render(<CategoryBadge category="ideas" />);
    expect(container.firstChild).not.toBeNull();
  });

  test('renders ideas category', () => {
    const { container } = render(<CategoryBadge category="ideas" />);
    expect(container.textContent).toContain('ideas');
  });

  test('renders feelings category', () => {
    const { container } = render(<CategoryBadge category="feelings" />);
    expect(container.textContent).toContain('feelings');
  });

  test('renders multiple categories', () => {
    const { container } = render(<CategoryBadge category={['ideas', 'feelings']} />);
    expect(container.textContent).toContain('ideas');
    expect(container.textContent).toContain('feelings');
  });

  test('renders nothing for null category', () => {
    const { container } = render(<CategoryBadge category={null as any} />);
    expect(container.firstChild).toBeNull();
  });

  test('renders nothing for empty array', () => {
    const { container } = render(<CategoryBadge category={[]} />);
    expect(container.firstChild).toBeNull();
  });

  test('applies custom styles', () => {
    const customStyle = { fontSize: '16px' };
    const { container } = render(<CategoryBadge category="ideas" style={customStyle} />);
    const badge = container.querySelector('span');
    expect(badge?.style.fontSize).toBe('16px');
  });
});