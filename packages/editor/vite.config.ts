import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  server: { host: true },
  build: {
    lib: {
      entry: {
        index: fileURLToPath(new URL('./src/lib.ts', import.meta.url)),
        // DOM-free TipTap converter, also used by the collab server in Node.
        convert: fileURLToPath(new URL('./src/convert/index.ts', import.meta.url)),
      },
      formats: ['es'],
      fileName: (_format, name) => `${name}.js`,
      cssFileName: 'style',
    },
    rollupOptions: {
      external: [/^react($|\/)/, /^react-dom($|\/)/, /^zustand($|\/)/],
    },
  },
  test: { environment: 'jsdom' },
} as any);
