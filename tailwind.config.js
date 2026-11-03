/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forge: {
          900: '#0f0f13',
          800: '#171720',
          700: '#222230',
          600: '#2d2d3f',
          500: '#3d3d52',
          border: '#3c3b4e',
          amber: '#f59e0b',
          ember: '#ff5722',
          gold: '#fbbf24',
          mythic: '#a855f7'
        }
      },
      fontFamily: {
        fantasy: ['Cinzel', 'Trajan Pro', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        'glow-gold': '0 0 15px rgba(251, 191, 36, 0.4)',
        'glow-ember': '0 0 20px rgba(255, 87, 34, 0.4)',
        'glow-mythic': '0 0 25px rgba(168, 85, 247, 0.5)'
      }
    },
  },
  plugins: [],
}
