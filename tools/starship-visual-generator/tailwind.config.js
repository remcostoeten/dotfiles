/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', 'Consolas', 'Courier New', 'monospace'],
      },
      colors: {
        terminal: {
          bg: '#0f1419',
          fg: '#e6f3ff',
        },
        haptic: {
          bg: '#0B0F14',
          surface: '#0F1419',
          muted: '#1B2430',
          border: '#1F2937',
          text: '#D4E3FF',
          subtext: '#98A9C6',
          accent: '#57A6FF',
          accent2: '#A78BFA',
        }
      }
    },
  },
  plugins: [],
}
