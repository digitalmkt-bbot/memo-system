/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // violet brand (kept under the legacy "ocean" keys so existing classes restyle globally)
        ocean: { DEFAULT: '#7c6cf5', dark: '#5a48d6', light: '#ece9fd' },
        sand: '#e6eaf3',       // app background
        surface: '#eef1f8',    // raised card / control surface
        ink: '#2b3245',
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans Thai', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        neu: '7px 7px 16px #c7cdda, -7px -7px 16px #ffffff',
        'neu-sm': '4px 4px 9px #c9cfdc, -4px -4px 9px #ffffff',
        'neu-inset': 'inset 4px 4px 8px #cbd1de, inset -4px -4px 8px #ffffff',
        'neu-press': 'inset 3px 3px 7px #c2c8d6, inset -3px -3px 7px #ffffff',
      },
      borderRadius: {
        '2xl': '1.1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
};
