import { useState, useEffect } from 'react';

export const useResponsive = () => {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Call once to set initial size

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Desktop breakpoint at 1024px
  const isDesktop = windowSize.width >= 1024;
  const isMobile = windowSize.width < 1024;
  const isTablet = windowSize.width >= 768 && windowSize.width < 1024;

  return {
    windowSize,
    isDesktop,
    isMobile,
    isTablet,
  };
};