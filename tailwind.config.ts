import type { Config } from 'tailwindcss'

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Waldorf-inspired earth tones and natural colors
        waldorf: {
          // Warm earth tones
          clay: {
            50: '#fdf8f6',
            100: '#f8ede8',
            200: '#f0d9cf',
            300: '#e4bcad',
            400: '#d49a85',
            500: '#c17d64',
            600: '#a86550',
            700: '#8b5242',
            800: '#72453a',
            900: '#5e3c33',
          },
          // Soft rose
          rose: {
            50: '#fdf5f4',
            100: '#fce8e6',
            200: '#f9d5d2',
            300: '#f4b5ae',
            400: '#ec8980',
            500: '#df6156',
            600: '#c74439',
            700: '#a7362e',
            800: '#8a312a',
            900: '#732f29',
          },
          // Warm sage/green
          sage: {
            50: '#f7f8f4',
            100: '#eef0e7',
            200: '#dce2cf',
            300: '#c2cdae',
            400: '#a4b389',
            500: '#87996b',
            600: '#6d7d54',
            700: '#566245',
            800: '#47513a',
            900: '#3c4432',
          },
          // Soft lavender
          lavender: {
            50: '#f9f7fb',
            100: '#f2eef6',
            200: '#e7e0ed',
            300: '#d4c6df',
            400: '#bba4cc',
            500: '#9f81b5',
            600: '#85659a',
            700: '#6f537f',
            800: '#5d4769',
            900: '#4e3d58',
          },
          // Warm cream/beige
          cream: {
            50: '#fdfcfb',
            100: '#faf8f4',
            200: '#f5f0e8',
            300: '#ebe2d4',
            400: '#dccdb5',
            500: '#c9b193',
            600: '#b39775',
            700: '#957c5f',
            800: '#7a6650',
            900: '#655543',
          },
          // Warm peach
          peach: {
            50: '#fef9f5',
            100: '#fdf0e8',
            200: '#fbddc7',
            300: '#f7c39c',
            400: '#f19f6a',
            500: '#e97d43',
            600: '#d76028',
            700: '#b44a1e',
            800: '#903d1d',
            900: '#75351c',
          },
        },
      },
      fontFamily: {
        sans: ['Source Sans 3', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['Merriweather', 'Georgia', 'serif'],
        display: ['Playfair Display', 'Georgia', 'serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.5s ease-out forwards',
        'slide-in-right': 'slideInRight 0.4s ease-out forwards',
        'scale-in': 'scaleIn 0.3s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
} satisfies Config
