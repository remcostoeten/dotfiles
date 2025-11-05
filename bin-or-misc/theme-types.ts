/**
 * TypeScript type definitions for the Dotfiles Theme
 * Use these types for type-safe theme integration in your projects
 */

export type ThemeMode = 'dark' | 'light';

export interface ThemeColors {
  background: {
    DEFAULT: string;
    secondary: string;
    tertiary: string;
    elevated: string;
    hover: string;
    active: string;
  };
  accent: {
    DEFAULT: string;
    dark: string;
    darker: string;
    bg: string;
    bgHover: string;
    subtle: string;
    glow: string;
  };
  foreground: {
    DEFAULT: string;
    bright: string;
    brighter: string;
    muted: string;
    subtle: string;
    faint: string;
    disabled: string;
    ghost: string;
  };
  border: {
    DEFAULT: string;
    primary: string;
    secondary: string;
    tertiary: string;
    subtle: string;
    hover: string;
    accent: string;
  };
  card: {
    bg: string;
    border: string;
    hover: string;
  };
  sidebar: {
    item: string;
    itemHover: string;
    itemActiveBg: string;
    itemIcon: string;
    itemIconHover: string;
    itemIconActive: string;
  };
  input: {
    bg: string;
    border: string;
    borderFocus: string;
    text: string;
  };
  button: {
    bg: string;
    border: string;
    text: string;
    hoverBg: string;
    hoverBorder: string;
    hoverText: string;
  };
}

export interface ThemeShadows {
  sm: string;
  md: string;
  lg: string;
  xl: string;
  accent: string;
  accentMd: string;
  accentLg: string;
}

export interface ThemeRadius {
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  full: string;
}

export interface ThemeTransitions {
  fast: string;
  base: string;
  slow: string;
}

export interface ThemeSpacing {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
}

export interface Theme {
  colors: ThemeColors;
  shadows: ThemeShadows;
}

export interface ThemeConfig {
  name: string;
  version: string;
  description: string;
  themes: {
    dark: Theme;
    light: Theme;
  };
  radius: ThemeRadius;
  transitions: ThemeTransitions;
  spacing: ThemeSpacing;
}

/**
 * CSS Variable names used in the theme
 */
export const CSS_VARIABLES = {
  // Backgrounds
  background: '--color-background',
  backgroundSecondary: '--color-background-secondary',
  backgroundTertiary: '--color-background-tertiary',
  backgroundElevated: '--color-background-elevated',
  backgroundHover: '--color-background-hover',
  backgroundActive: '--color-background-active',

  // Accent
  accent: '--color-accent',
  accentDark: '--color-accent-dark',
  accentDarker: '--color-accent-darker',
  accentBg: '--color-accent-bg',
  accentBgHover: '--color-accent-bg-hover',
  accentSubtle: '--color-accent-subtle',
  accentGlow: '--color-accent-glow',

  // Foreground
  foreground: '--color-foreground',
  foregroundBright: '--color-foreground-bright',
  foregroundBrighter: '--color-foreground-brighter',
  foregroundMuted: '--color-foreground-muted',
  foregroundSubtle: '--color-foreground-subtle',
  foregroundFaint: '--color-foreground-faint',
  foregroundDisabled: '--color-foreground-disabled',
  foregroundGhost: '--color-foreground-ghost',

  // Borders
  borderPrimary: '--color-border-primary',
  borderSecondary: '--color-border-secondary',
  borderTertiary: '--color-border-tertiary',
  borderSubtle: '--color-border-subtle',
  borderHover: '--color-border-hover',
  borderAccent: '--color-border-accent',

  // Shadows
  shadowSm: '--shadow-sm',
  shadowMd: '--shadow-md',
  shadowLg: '--shadow-lg',
  shadowXl: '--shadow-xl',
  shadowAccent: '--shadow-accent',
  shadowAccentMd: '--shadow-accent-md',
  shadowAccentLg: '--shadow-accent-lg',

  // Radius
  radiusSm: '--radius-sm',
  radiusMd: '--radius-md',
  radiusLg: '--radius-lg',
  radiusXl: '--radius-xl',
  radius2xl: '--radius-2xl',
  radiusFull: '--radius-full',

  // Transitions
  transitionFast: '--transition-fast',
  transitionBase: '--transition-base',
  transitionSlow: '--transition-slow',
} as const;

/**
 * Helper function to get CSS variable value
 */
export function getCSSVariable(variable: string): string {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
}

/**
 * Helper function to set CSS variable value
 */
export function setCSSVariable(variable: string, value: string): void {
  if (typeof window === 'undefined') return;
  document.documentElement.style.setProperty(variable, value);
}

/**
 * Theme hook for React (example implementation)
 */
export interface UseThemeReturn {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  systemTheme: ThemeMode;
}

/**
 * Type for theme-aware styled components
 */
export interface ThemedProps {
  theme: ThemeMode;
}

/**
 * Utility type for component variants
 */
export type ComponentVariant = 'default' | 'accent' | 'muted' | 'ghost';

/**
 * Utility type for component sizes
 */
export type ComponentSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Button props with theme support
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ComponentVariant;
  size?: ComponentSize;
}

/**
 * Card props with theme support
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  hoverable?: boolean;
}

/**
 * Input props with theme support
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  success?: boolean;
}

/**
 * Export theme config type for external use
 */
export type { ThemeConfig as default };