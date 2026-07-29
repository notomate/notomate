import { defineConfig } from 'vite'
import path from 'path'
import react from '@vitejs/plugin-react-swc'


export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/ws/public': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
        headers: { 'X-Public-Access': 'true' },
      },
      '/ws': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
        headers: { 'X-Public-Access': 'false' },
      },
      '/socket.io': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        ws: true,
      },
    }
  },
  resolve: {
    alias: {
      '@': path.resolve('src'),
    },
  },
})
