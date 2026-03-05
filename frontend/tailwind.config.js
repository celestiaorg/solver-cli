/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          0: '#070712',
          1: '#0d0d1e',
          2: '#141428',
          3: '#1b1b34',
          4: '#22223e',
        },
        brand: {
          DEFAULT: '#7c3aed',
          light: '#a78bfa',
          dark: '#5b21b6',
        },
        border: {
          DEFAULT: '#1a1a30',
          light: '#242448',
          brand: 'rgba(124, 58, 237, 0.35)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'brand':    '0 0 20px rgba(124, 58, 237, 0.22)',
        'brand-lg': '0 0 40px rgba(124, 58, 237, 0.28)',
        'card':     '0 4px 32px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.035)',
        'input-focus': '0 0 0 2px rgba(124, 58, 237, 0.28)',
      },
      animation: {
        'spin-slow':   'spin-slow 1.6s linear infinite',
        'pulse-glow':  'pulse-glow 3.5s ease-in-out infinite',
        'fade-in':     'fade-in 0.2s ease-out forwards',
        'slide-up':    'slide-up 0.25s ease-out forwards',
      },
      keyframes: {
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to:   { transform: 'rotate(360deg)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(124,58,237,0)' },
          '50%':       { boxShadow: '0 0 48px 4px rgba(124,58,237,0.1)' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(5px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
