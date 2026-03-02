import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // Cesium ships worker modules that Vite's dep optimizer can mis-handle.
    // Excluding it prevents broken /.vite/deps/Workers/* lookups in dev.
    exclude: ['cesium']
  },
  server: {
    port: 5173,
    host: true
  }
});
