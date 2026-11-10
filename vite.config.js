import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:1234',
        changeOrigin: true
      },
      '/agent-avatars': {
        target: 'http://localhost:1234',
        changeOrigin: true
      },
      '/agents': {
        target: 'http://localhost:1234',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
