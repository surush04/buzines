/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: '#1c1915',
        cream: '#f4f0e8',
        gold: '#e4b12f',
        primary: {
          50: '#fff8e8',
          100: '#fdeec4',
          200: '#f8dc8a',
          300: '#f3c85a',
          400: '#e4b12f',
          500: '#d4a017',
          600: '#c99212',
          700: '#a8740d',
          800: '#7c560c',
          900: '#5c400c',
          950: '#2a220c',
        },
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
