import React, { useEffect } from 'react';
import { useUiStore } from '../store/uiStore';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useUiStore();

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  return <>{children}</>;
}
