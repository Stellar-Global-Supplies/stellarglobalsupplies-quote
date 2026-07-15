/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f7f3',
          100: '#d6eadf',
          200: '#aed4c0',
          300: '#7db99a',
          400: '#4e9c74',
          500: '#1a5c3a',  // primary — SGS deep forest green
          600: '#174f32',
          700: '#133f28',
          800: '#0e2f1e',
          900: '#091f14',
        },
        gold: {
          400: '#d4b05a',
          500: '#c9a84c',  // SGS gold accent
          600: '#b8922e',
        },
        dark: '#0f1a14',
        ink:  '#1e2d25',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.07)',
        'card-hover': '0 4px 12px 0 rgb(26 92 58 / 0.15), 0 2px 4px -1px rgb(0 0 0 / 0.08)',
      },
    },
  },
  plugins: [],
}
