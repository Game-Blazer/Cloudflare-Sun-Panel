/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#4a90d9',
        'glass-bg': 'rgba(255, 255, 255, 0.05)',
        'glass-bg-hover': 'rgba(255, 255, 255, 0.15)',
      },
      borderRadius: {
        'glass': '0.75rem',
      },
      backdropBlur: {
        'glass': '12px',
      },
    },
  },
  plugins: [],
}