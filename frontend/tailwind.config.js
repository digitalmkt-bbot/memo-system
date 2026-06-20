/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // emerald/mint brand (kept under the legacy "ocean" keys so existing classes restyle globally)
        ocean: { DEFAULT: '#10b981', dark: '#059669', light: '#d1fae5' },
        sand: '#f3f4f1',       // app background (warm off-white)
        surface: '#ffffff',    // cards
        ink: '#1f2937',        // dark slate
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans Thai', 'system-ui', 'sans-serif'],
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
