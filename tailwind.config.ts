import type { Config } from 'tailwindcss';

/**
 * Tailwind CSS Configuration
 * 
 * Design system for the Oyrenoyret.org platform.
 * Color palette: Blue primary with neutral tones.
 * Design tone: Academic, trustworthy, calm.
 */

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontWeight: {
        // Typography tuning: GitHub-like contrast without heavy "bold" rendering.
        // Inter (variable) supports these intermediate weights.
        medium: '500',
        semibold: '560',
        // Keep `font-bold` restrained if it appears.
        bold: '600',
      },
      fontFamily: {
        // Use Inter (Next font) everywhere via Tailwind's font-sans
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        comfortaa: ['var(--font-comfortaa)', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Semantic colors (shadcn/ui) - must come first
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          // Extended palette for custom use
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        // Neutral Palette (Balanced white & black tones)
        neutral: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
          950: '#0a0a0a',
        },
      },
      borderRadius: {
        lg: 'var(--radius-lg)',
        md: 'var(--radius)',
        sm: 'calc(var(--radius) - 4px)',
        xl: 'var(--radius-xl)',
      },
      animation: {
        'progress-fill': 'progress-fill 0.5s ease-out',
        'bounce-in': 'bounce-in 0.4s ease-out',
        'skeleton-shimmer': 'skeleton-shimmer 2s ease-in-out infinite',
      },
      keyframes: {
        'skeleton-shimmer': {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
