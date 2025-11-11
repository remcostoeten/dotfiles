/**
 * Next.js Integration for Dotfiles Theme
 *
 * This file contains everything you need to integrate the theme into a Next.js project
 */

// ============================================================================
// 1. Theme Provider for App Router (app/providers.tsx)
// ============================================================================

'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type ThemeMode = 'dark' | 'light';

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem('theme') as ThemeMode | null;
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
    setThemeState(initialTheme);
    document.documentElement.setAttribute('data-theme', initialTheme);
  }, []);

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

// ============================================================================
// 2. Root Layout (app/layout.tsx)
// ============================================================================

/**
 * Example layout.tsx:
 *
 * import { ThemeProvider } from './providers';
 * import './globals.css';
 *
 * export const metadata = {
 *   title: 'My App',
 *   description: 'App with theme support',
 * };
 *
 * export default function RootLayout({
 *   children,
 * }: {
 *   children: React.ReactNode;
 * }) {
 *   return (
 *     <html lang="en" suppressHydrationWarning>
 *       <head>
 *         <script
 *           dangerouslySetInnerHTML={{
 *             __html: `
 *               (function() {
 *                 const theme = localStorage.getItem('theme') ||
 *                   (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
 *                 document.documentElement.setAttribute('data-theme', theme);
 *               })();
 *             `,
 *           }}
 *         />
 *       </head>
 *       <body>
 *         <ThemeProvider>{children}</ThemeProvider>
 *       </body>
 *     </html>
 *   );
 * }
 */

// ============================================================================
// 3. Global Styles (app/globals.css)
// ============================================================================

/**
 * Add to your globals.css:
 *
 * @tailwind base;
 * @tailwind components;
 * @tailwind utilities;
 *
 * @import "../path/to/tailwind-theme.css";
 *
 * body {
 *   font-family: 'JetBrains Mono', 'Fira Code', monospace;
 *   background: var(--color-background);
 *   color: var(--color-foreground);
 *   transition: background-color 0.3s ease, color 0.3s ease;
 * }
 */

// ============================================================================
// 4. Theme Toggle Component (components/ThemeToggle.tsx)
// ============================================================================

'use client';

import { useTheme } from '@/app/providers';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="btn"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      style={{
        width: '44px',
        height: '44px',
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

// ============================================================================
// 5. Example Page (app/page.tsx)
// ============================================================================

/**
 * Example page.tsx:
 *
 * import { ThemeToggle } from '@/components/ThemeToggle';
 *
 * export default function Home() {
 *   return (
 *     <div className="min-h-screen bg-background">
 *       <header className="bg-background-secondary border-b border-primary">
 *         <div className="container mx-auto px-4 py-4 flex items-center justify-between">
 *           <h1 className="text-foreground-bright text-2xl font-bold">My App</h1>
 *           <ThemeToggle />
 *         </div>
 *       </header>
 *
 *       <main className="container mx-auto px-4 py-8">
 *         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 *           <div className="card">
 *             <h2 className="text-foreground-bright text-xl mb-2">Card 1</h2>
 *             <p className="text-foreground-muted">This is a themed card component</p>
 *           </div>
 *           <div className="card">
 *             <h2 className="text-foreground-bright text-xl mb-2">Card 2</h2>
 *             <p className="text-foreground-muted">With smooth transitions</p>
 *           </div>
 *           <div className="card">
 *             <h2 className="text-foreground-bright text-xl mb-2">Card 3</h2>
 *             <p className="text-foreground-muted">Between light and dark</p>
 *           </div>
 *         </div>
 *
 *         <div className="mt-8 card">
 *           <h2 className="text-foreground-bright text-2xl mb-4">Sign In</h2>
 *           <form className="space-y-4">
 *             <div>
 *               <label className="block text-foreground-muted mb-2">Email</label>
 *               <input
 *                 type="email"
 *                 className="input w-full"
 *                 placeholder="your@email.com"
 *               />
 *             </div>
 *             <div>
 *               <label className="block text-foreground-muted mb-2">Password</label>
 *               <input
 *                 type="password"
 *                 className="input w-full"
 *                 placeholder="••••••••"
 *               />
 *             </div>
 *             <button type="submit" className="btn btn-accent w-full">
 *               Sign In
 *             </button>
 *           </form>
 *         </div>
 *       </main>
 *     </div>
 *   );
 * }
 */

// ============================================================================
// 6. Reusable Components
// ============================================================================

'use client';

import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  elevated?: boolean;
}

export function Card({ children, className = '', elevated = false }: CardProps) {
  return (
    <div
      className={`card ${elevated ? 'shadow-lg' : ''} ${className}`}
      style={{
        background: 'var(--color-card-bg)',
        border: '1px solid var(--color-card-border)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--spacing-md)',
        transition: 'var(--transition-all)',
      }}
    >
      {children}
    </div>
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'accent';
  children: ReactNode;
}

export function Button({
  variant = 'default',
  children,
  className = '',
  ...props
}: ButtonProps) {
  const baseClass = 'btn';
  const variantClass = variant === 'accent' ? 'btn-accent' : '';

  return (
    <button
      className={`${baseClass} ${variantClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className = '', ...props }: InputProps) {
  return (
    <input
      className={`input ${className}`}
      {...props}
    />
  );
}

// ============================================================================
// 7. Server Component Example (app/dashboard/page.tsx)
// ============================================================================

/**
 * Example server component that uses themed components:
 *
 * import { Card, Button } from '@/components/themed';
 * import { ThemeToggle } from '@/components/ThemeToggle';
 *
 * // This can be a server component
 * export default function Dashboard() {
 *   return (
 *     <div className="min-h-screen bg-background">
 *       <nav className="bg-background-secondary border-b border-primary p-4">
 *         <div className="container mx-auto flex items-center justify-between">
 *           <h1 className="text-foreground-bright text-xl">Dashboard</h1>
 *           <ThemeToggle />
 *         </div>
 *       </nav>
 *
 *       <main className="container mx-auto p-4">
 *         <Card>
 *           <h2 className="text-foreground-bright text-xl mb-2">Welcome</h2>
 *           <p className="text-foreground-muted mb-4">
 *             This is a server component with themed styling
 *           </p>
 *           <Button variant="accent">Get Started</Button>
 *         </Card>
 *       </main>
 *     </div>
 *   );
 * }
 */

// ============================================================================
// 8. API Route Example (app/api/theme/route.ts)
// ============================================================================

/**
 * Example API route to save user theme preference:
 *
 * import { NextResponse } from 'next/server';
 *
 * export async function POST(request: Request) {
 *   const { theme } = await request.json();
 *
 *   // Save to database or return theme
 *   // This is where you'd persist the user's theme preference
 *
 *   return NextResponse.json({ theme });
 * }
 */

// ============================================================================
// 9. Middleware Example (middleware.ts)
// ============================================================================

/**
 * Optional: Add middleware to detect theme from cookies
 *
 * import { NextResponse } from 'next/server';
 * import type { NextRequest } from 'next/server';
 *
 * export function middleware(request: NextRequest) {
 *   const theme = request.cookies.get('theme')?.value || 'dark';
 *   const response = NextResponse.next();
 *
 *   // Set theme header for server components
 *   response.headers.set('x-theme', theme);
 *
 *   return response;
 * }
 */

export {};