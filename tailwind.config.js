/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ruxt: {
          50: '#f0f4ff',
          100: '#dbe4fe',
          200: '#bfd0fe',
          500: '#4361ee',
          600: '#3a0ca3',
          700: '#2b0a78',
          900: '#0f172a',
          950: '#090d16'
        }
      }
    },
  },
  plugins: [],
}
