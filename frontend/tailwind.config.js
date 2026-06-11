/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ocean: { DEFAULT: '#0a6e7c', dark: '#074e58', light: '#e6f4f6' },
        sand: '#f6f3ec',
        ink: '#1d2733',
      },
      fontFamily: {
        sans: ['Noto Sans Thai', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
