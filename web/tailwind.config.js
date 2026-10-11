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
      // App-wide stacking order (mirrored in src/lib/zIndex.ts). Use these names
      // instead of raw numbers so layers stay consistent. Components with internal layering (maps,
      // whiteboard, carousel) should `isolate` their root and keep inner
      // z-indexes small (z-10/z-20) so they never escape into this scale.
      zIndex: {
        sidebar: '40',            // fixed app sidebar
        dropdown: '50',           // in-flow absolute menus / autocomplete lists
        'drawer-backdrop': '60',  // mobile bottom sheets & side drawers
        drawer: '61',
        fullscreen: '80',         // fullscreen overlays (e.g. map fullscreen)
        'modal-backdrop': '100',
        modal: '101',
        'modal-nested-backdrop': '110',
        'modal-nested': '111',
        lightbox: '150',          // image viewer (react-photo-view), above any modal
        popover: '200',           // portaled dropdown/select/context menus (above modals)
        tooltip: '250',
        toast: '300',             // toasts & upload panel
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

