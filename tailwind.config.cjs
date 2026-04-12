/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.vue'
  ],
  theme: {
    extend: {
      colors: {
        ios: {
          blue: '#007AFF',
          gray: '#E9E9EB',
          grayDark: '#262626',
          green: '#34C759',
          red: '#FF3B30'
        }
      }
    }
  },
  plugins: []
}
