import React from 'react';
import { Link } from 'react-router-dom';
import { Moon, Sun, TerminalSquare } from 'lucide-react';
import { Button } from './ui/button';
import { useUiStore } from '../store/uiStore';

export function Layout({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useUiStore();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity" data-testid="link-home">
            <TerminalSquare className="w-6 h-6 text-primary" />
            <span className="font-bold tracking-tight">DOP Cockpit</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              data-testid="button-theme-toggle"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
