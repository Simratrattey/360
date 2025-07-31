// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  // ← Add this block
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
    },
  },
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    headers: {
      // this ensures the same header on localhost:3000
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups'
    },
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});