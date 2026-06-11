import { create } from 'zustand';

interface UiState {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (v: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  theme: (localStorage.getItem('theme') as 'light' | 'dark') || 'dark',
  setTheme: (theme) => {
    localStorage.setItem('theme', theme);
    set({ theme });
  },
  sidebarOpen: localStorage.getItem('sidebarOpen') !== 'false',
  toggleSidebar: () =>
    set(s => {
      const next = !s.sidebarOpen;
      localStorage.setItem('sidebarOpen', String(next));
      return { sidebarOpen: next };
    }),
  setSidebarOpen: (v: boolean) => {
    localStorage.setItem('sidebarOpen', String(v));
    set({ sidebarOpen: v });
  },
}));
