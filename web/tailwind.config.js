/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'selector',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        satoshi: ['Satoshi', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
      },
      colors: {
        foreground: "var(--foreground)",
        "muted-foreground": "var(--muted-foreground)",
        heading: "var(--heading)",
        disabled: "var(--disabled)",
        primary: {
          DEFAULT: 'var(--primary)',
          50: 'var(--primary-50)',
          100: 'var(--primary-100)',
          200: 'var(--primary-200)',
          300: 'var(--primary-300)',
          400: 'var(--primary-400)',
          500: 'var(--primary-500)',
          600: 'var(--primary-600)',
          700: 'var(--primary-700)',
          800: 'var(--primary-800)',
          900: 'var(--primary-900)',
          foreground: 'var(--primary-foreground)',
          hover: 'var(--primary-hover)',
          active: 'var(--primary-active)',
          light: 'var(--primary-light)',
          lighter: 'var(--primary-lighter)',
        }
      },
      screens: {
        '2xl': '1536px',
        '3xl': '1920px',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
    gridTemplateColumns: {
      '1': 'repeat(1, minmax(0, 1fr));',
      '2': 'repeat(2, minmax(0, 1fr));',
      '3': 'repeat(3, minmax(0, 1fr));',
      '4': 'repeat(4, minmax(0, 1fr));',
      '7': 'repeat(7, minmax(0, 1fr));',
      'auto-fill-140': 'repeat(auto-fill, minmax(140px, 1fr));',
      'auto-fill-240': 'repeat(auto-fill, minmax(240px, 1fr));',
      'auto-fill-320': 'repeat(auto-fill, minmax(320px, 1fr));',
    },
  },
  plugins: [
    require('@tailwindcss/container-queries'),
  ],
}

