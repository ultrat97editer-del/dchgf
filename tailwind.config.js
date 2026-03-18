export default {
  theme: {
    extend: {
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