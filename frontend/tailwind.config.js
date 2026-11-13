/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        karya: {
          // Brand primary (Keystone indigo)
          blue: {
            DEFAULT: '#4F46E5',
            light: '#E0E7FF',
            dark: '#3730A3',
          },
          green: {
            DEFAULT: '#37A169',
            light: '#E6F4EA',
            dark: '#1C6B45',
          },
          red: {
            DEFAULT: '#E53E3E',
            light: '#FFF5F5',
            dark: '#9B2C2C',
          },
          orange: {
            DEFAULT: '#D69E2E',
            light: '#FEF9E7',
            dark: '#975A16',
          },
          // Brand accent. Fills, dots and icons on dark surfaces only —
          // white text on saffron fails contrast, so pair it with dark ink.
          saffron: {
            DEFAULT: '#F59E0B',
            light: '#FEF3C7',
            dark: '#D97706',
          },
          mint: '#3BE8B0',
          slate: '#6A67CE',
          bg: '#F9FBFC',
          surface: '#FFFFFF',
          border: '#E8ECEF',
          text: {
            primary: '#1E293B',
            secondary: '#64748B',
            muted: '#94A3B8',
          }
        },
        primary: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#4F46E5',
          600: '#4338CA',
          700: '#3730A3',
          800: '#312E81',
          900: '#1E1B4B',
        }
      },
      borderRadius: {
        'karya': '6px',
        'karya-lg': '12px',
      },
      boxShadow: {
        'karya-card': '0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1)',
        'karya-hover': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'karya-row': '0 2px 8px -2px rgba(15, 23, 42, 0.08), 0 1px 3px -1px rgba(15, 23, 42, 0.06)',
        'karya-row-dark': '0 2px 12px -2px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.04)',
        'karya-pop': '0 12px 32px -8px rgba(15, 23, 42, 0.18), 0 4px 12px -4px rgba(15, 23, 42, 0.10)',
      },
      transitionTimingFunction: {
        'karya': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      transitionDuration: {
        '180': '180ms',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slideDown 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        'pop-in': 'popIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        popIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      }
    },
  },
  plugins: [],
};
