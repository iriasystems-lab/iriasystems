/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        gold: '#B87333',
        'gold-light': '#D4925A',
        'gold-dark': '#8C5620',
        cream: '#F5F0E8',
        'cream-dark': '#EDE5D4',
        charcoal: '#1A1A1A',
        'warm-gray': '#8A8275',
        'warm-brown': '#6B5B3E',
        champagne: '#E8DCC8',
      },
      fontFamily: {
        sans: ['Space Grotesk', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
