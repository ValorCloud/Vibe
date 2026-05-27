/**
 * useThemeState
 *
 * Owns: theme toggle + applies `dark` class to <html>.
 * Extracted from useSessionState (Phase-2 domain-hook split).
 */
import { useState, useEffect } from 'react';

const THEME_STORAGE_KEY = 'vibe_theme';

export function useThemeState() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      return storedTheme === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {}
  }, [theme]);

  return { theme, setTheme };
}
