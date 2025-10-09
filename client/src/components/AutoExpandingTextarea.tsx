import React, {
    useCallback,
    useImperativeHandle,
    useLayoutEffect,
    useRef,
    forwardRef,
} from 'react';

export interface AutoExpandingTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    minHeight?: number | string;
    maxHeight?: number | string;
}

const resolvePixels = (value?: number | string): number | null => {
    if (value === undefined) {
        return null;
    }

    if (typeof value === 'number' && !Number.isNaN(value)) {
        return value;
    }

    if (typeof value === 'string') {
        const trimmed = value.trim().toLowerCase();

        if (trimmed.endsWith('px')) {
            const parsed = parseFloat(trimmed.replace('px', ''));
            return Number.isNaN(parsed) ? null : parsed;
        }

        if (trimmed.endsWith('vh') && typeof window !== 'undefined') {
            const parsed = parseFloat(trimmed.replace('vh', ''));
            if (Number.isNaN(parsed)) {
                return null;
            }
            return (window.innerHeight * parsed) / 100;
        }
    }

    return null;
};

const AutoExpandingTextarea = forwardRef<HTMLTextAreaElement, AutoExpandingTextareaProps>(({
    minHeight = 120,
    maxHeight = '60vh',
    style,
    onChange,
    value,
    ...rest
}, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    useImperativeHandle(ref, () => textareaRef.current);

    const adjustHeight = useCallback(() => {
        const textarea = textareaRef.current;
        if (!textarea) {
            return;
        }

        textarea.style.height = 'auto';

        const minPixels = resolvePixels(minHeight);
        const maxPixels = resolvePixels(maxHeight);

        const scrollHeight = textarea.scrollHeight;
        const minHeightValue = minPixels ?? scrollHeight;
        let nextHeight = Math.max(scrollHeight, minHeightValue);

        if (maxPixels && nextHeight > maxPixels) {
            nextHeight = maxPixels;
            textarea.style.overflowY = 'auto';
        } else {
            textarea.style.overflowY = 'hidden';
        }

        textarea.style.height = `${nextHeight}px`;
    }, [minHeight, maxHeight]);

    useLayoutEffect(() => {
        adjustHeight();
    }, [adjustHeight, value]);

    const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        onChange?.(event);

        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(adjustHeight);
        } else {
            adjustHeight();
        }
    };

    const mergedStyle: React.CSSProperties = {
        resize: 'none',
        overflow: 'hidden',
        transition: 'height 0.2s ease',
        minHeight: typeof minHeight === 'number' ? `${minHeight}px` : minHeight,
        maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight,
        ...style,
    };

    return (
        <textarea
            {...rest}
            ref={textareaRef}
            style={mergedStyle}
            onChange={handleChange}
            value={value}
        />
    );
});

AutoExpandingTextarea.displayName = 'AutoExpandingTextarea';

export default AutoExpandingTextarea;
