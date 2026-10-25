import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig({
  root: 'client',
  // legacy(): the production build also ships a fallback bundle for older phone browsers.
  plugins: [react(), legacy({ targets: ['defaults', 'Android >= 6', 'iOS >= 11', 'not IE 11'] })],
  server: {
    port: 5173,
    host: true, // listen on the LAN too, e.g. http://192.168.1.6:5173
    proxy: {
      '/api': 'http://localhost:4000',
      '/uploads': 'http://localhost:4000',
    },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
