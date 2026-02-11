'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
});

/**
 * Hook to access the current theme and toggle function.
 */
export const useTheme = () => useContext(ThemeContext);

/**
 * ThemeProvider — manages light/dark theme state.
 *
 * - Persists preference in localStorage under `qcd-theme`.
 * - Falls back to system preference on first visit.
 * - Applies `data-theme` attribute on the `<html>` element.
 */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  // Read saved theme or system preference on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('qcd-theme') as Theme | null;
      if (saved === 'light' || saved === 'dark') {
        setTheme(saved);
      } else if (window.matchMedia?.('(prefers-color-scheme: light)').matches) {
        setTheme('light');
      }
    } catch {
      // localStorage may not be available
    }
    setMounted(true);
  }, []);

  // Sync `data-theme` attribute on <html> whenever theme changes
  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('qcd-theme', theme);
    } catch {
      // localStorage may not be available
    }
  }, [theme, mounted]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
