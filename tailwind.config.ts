import type { Config } from 'tailwindcss';

export default {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          green: '#009C3B',
          yellow: '#FFDF00',
          'green-dark': '#007A2E',
          'yellow-dark': '#E6C200',
        },
        neutral: {
          50: '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
        },
      },
      backgroundColor: {
        primary: '#0D1117',
        secondary: '#161B22',
        tertiary: '#21262D',
      },
      textColor: {
        primary: '#E6EDF3',
        secondary: '#8B949E',
        tertiary: '#6E7681',
      },
      borderColor: {
        primary: '#30363D',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
        display: ['var(--font-geist-mono)', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-light': 'bounce 1s infinite',
      },
    },
  },
  darkMode: 'class',
  plugins: [],
} satisfies Config;
