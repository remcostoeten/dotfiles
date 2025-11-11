/**
 * React Hooks for Dotfiles Theme
 *
 * Usage:
 * import { useTheme, ThemeProvider } from './theme-react-hooks';
 *
 * // Wrap your app
 * <ThemeProvider>
 *   <App />
 * </ThemeProvider>
 *
 * // Use in components
 * const { theme, toggleTheme } = useTheme();
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type ThemeMode = 'dark' | 'light';

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  systemTheme: ThemeMode;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: ThemeMode;
  storageKey?: string;
}

export function ThemeProvider({
  children,
  defaultTheme = 'dark',
  storageKey = 'dotfiles-theme',
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeMode>(defaultTheme);
  const [systemTheme, setSystemTheme] = useState<ThemeMode>('dark');
  const [mounted, setMounted] = useState(false);

  // Get system theme preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemTheme(mediaQuery.matches ? 'dark' : 'light');

    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Load saved theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem(storageKey) as ThemeMode | null;
    if (savedTheme) {
      setThemeState(savedTheme);
    } else {
      setThemeState(systemTheme);
    }
    setMounted(true);
  }, [storageKey, systemTheme]);

  // Apply theme to document
  useEffect(() => {
    if (mounted) {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem(storageKey, theme);
    }
  }, [theme, mounted, storageKey]);

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Prevent flash of unstyled content
  if (!mounted) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, systemTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

/**
 * Hook to get CSS variable values
 */
export function useCSSVariable(variable: string): string {
  const [value, setValue] = useState('');

  useEffect(() => {
    const updateValue = () => {
      const computedValue = getComputedStyle(document.documentElement)
        .getPropertyValue(variable)
        .trim();
      setValue(computedValue);
    };

    updateValue();

    // Update when theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'data-theme'
        ) {
          updateValue();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, [variable]);

  return value;
}

/**
 * Hook to check if theme is dark
 */
export function useIsDark(): boolean {
  const { theme } = useTheme();
  return theme === 'dark';
}

/**
 * Example Theme Toggle Component
 */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="btn"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      style={{
        width: '40px',
        height: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.25rem',
      }}
    >
      {theme === 'dark' ? '🌙' : '☀️'}
    </button>
  );
}

/**
 * Example Themed Component
 */
interface ThemedBoxProps {
  children: ReactNode;
  variant?: 'default' | 'accent' | 'elevated';
  className?: string;
}

export function ThemedBox({ children, variant = 'default', className = '' }: ThemedBoxProps) {
  const baseClass = 'card';
  const variantClass = variant === 'accent' ? 'bg-accent-bg border-accent' : '';

  return (
    <div className={`${baseClass} ${variantClass} ${className}`}>
      {children}
    </div>
  );
}

/**
 * Example usage in a component
 *
 * import { useTheme, ThemeToggle, ThemedBox } from './theme-react-hooks';
 *
 * function MyComponent() {
 *   const { theme } = useTheme();
 *
 *   return (
 *     <div className="bg-background text-foreground">
 *       <header className="flex items-center justify-between p-4">
 *         <h1>My App</h1>
 *         <ThemeToggle />
 *       </header>
 *
 *       <main className="container mx-auto p-4">
 *         <ThemedBox variant="accent">
 *           <h2>Current theme: {theme}</h2>
 *           <p>Theme-aware component!</p>
 *         </ThemedBox>
 *       </main>
 *     </div>
 *   );
 * }
 */