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
        gemini: {
          bg: '#131314',
          canvas: '#131314',
          surface: '#1E1F20',
          elevated: '#282A2C',
          card: '#282A2C',
          'active-bg': '#004A77',
          'active-text': '#7DACF8',
          hover: '#333538',
          border: '#3c4043',
          blue: '#7DACF8',
          'blue-dark': '#4182EB',
          text: '#E3E3E3',
          muted: '#8E918F',
          sparkle1: '#7DACF8',
          sparkle2: '#A8C7FA',
          sparkle3: '#D3E3FD',
          purple: '#B87CF8',
          danger: '#F28B82',
          success: '#81C995',
          warning: '#FDD663'
        }
      },
      fontFamily: {
        sans: ['Google Sans', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'sparkle-spin': 'spin 4s linear infinite',
      }
    },
  },
  plugins: [],
}
