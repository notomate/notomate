// Mirrors the `zIndex` scale in tailwind.config.js for places that need a
// numeric value (inline styles, third-party options). Keep the two in sync.
export const Z_INDEX = {
  sidebar: 40,
  dropdown: 50,
  drawerBackdrop: 60,
  drawer: 61,
  fullscreen: 80,
  modalBackdrop: 100,
  modal: 101,
  modalNestedBackdrop: 110,
  modalNested: 111,
  lightbox: 150,
  popover: 200,
  tooltip: 250,
  toast: 300,
} as const
