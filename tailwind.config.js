/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        outfit: ['Outfit', 'sans-serif'],
      },
      backgroundImage: {
        'glow-purple': 'radial-gradient(circle, rgba(168,85,247,0.15) 0%, rgba(168,85,247,0) 70%)',
        'glow-cyan': 'radial-gradient(circle, rgba(6,182,212,0.1) 0%, rgba(6,182,212,0) 70%)',
      },
      boxShadow: {
        'cyan-glow': '0 0 20px rgba(6, 182, 212, 0.15)',
        'purple-glow': '0 0 25px rgba(168, 85, 247, 0.12)',
      },
      textColor: {
        'slate-350': '#b0b8c6',
      },
      colors: {
        purple: {
          950: '#1e0c3a',
        }
      }
    },
  },
  plugins: [],
}
