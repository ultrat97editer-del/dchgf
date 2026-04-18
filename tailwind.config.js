export default {
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
      },
      colors: {
        'apple-gray': {
          50: '#FAFAFA',
          100: '#F5F5F7',
          200: '#EFEFF0',
          300: '#E5E5E7',
          400: '#D1D1D6',
          500: '#BFBFBF',
          600: '#A1A1A6',
          700: '#86868B',
          800: '#555555',
          900: '#1D1D1F',
        },
        'apple-blue': '#0071E3',
        'apple-red': '#FF3B30',
        'apple-green': '#34C759',
      },
      spacing: {
        '1.5': '0.375rem',
        '2.5': '0.625rem',
      },
      borderRadius: {
        'apple': '12px',
        'apple-lg': '16px',
        'apple-xl': '20px',
      },
      boxShadow: {
        'apple-sm': '0 1px 2px rgba(0, 0, 0, 0.05)',
        'apple-md': '0 2px 8px rgba(0, 0, 0, 0.1)',
        'apple-lg': '0 10px 32px rgba(0, 0, 0, 0.1), 0 1px 1px rgba(0, 0, 0, 0.05)',
        'apple-xl': '0 20px 64px rgba(0, 0, 0, 0.12)',
      },
      animation: {
        'slide-in': 'slideIn 0.4s ease-out',
      },
      keyframes: {
        slideIn: {
          'from': { transform: 'translateX(400px)', opacity: '0' },
          'to': { transform: 'translateX(0)', opacity: '1' },
        },
      },
    },
  },
}