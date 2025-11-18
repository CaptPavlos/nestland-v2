/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'nest-gold': '#D4AF37',
        'nest-gold-soft': '#E2C76A',
        'nest-green-dark': '#0B3B2E',
        'nest-brown': '#4B3B2A',
        'nest-bg': '#050608',
        'nest-surface': '#111315',
      },
      fontFamily: {
        sans: ['system-ui', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'soft-elevated': '0 24px 60px rgba(0,0,0,0.65)',
      },
    },
  },
  plugins: [],
}
