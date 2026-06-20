/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Optivue design system palette
        ocean: { DEFAULT: '#4ade80', dark: '#22c55e', light: '#dcfce7' }, // green mint (primary)
        blush: { DEFAULT: '#ff6fb5', dark: '#ff4fa3', light: '#ffd9ec' },  // pink (secondary)
        sand: '#f5f5f5',       // app background
        surface: '#ffffff',    // cards
        ink: '#1a1a1a',        // text
      },
      fontFamily: {
        sans: ['Prompt', 'Noto Sans Thai', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        neu: '0 8px 30px rgba(17,24,39,0.06)',
        'neu-sm': '0 1px 2px rgba(17,24,39,0.06), 0 1px 1px rgba(17,24,39,0.04)',
        'neu-inset': 'inset 0 0 0 1px rgba(17,24,39,0.07)',
        'neu-press': 'inset 0 1px 2px rgba(17,24,39,0.10)',
      },
      borderRadius: {
        '2xl': '1.1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
};
