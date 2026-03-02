import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const CESIUM_RUNTIME_ENTRY = fileURLToPath(
  new URL('../../node_modules/cesium/Build/CesiumUnminified/index.js', import.meta.url)
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [{ find: 'cesium-runtime', replacement: CESIUM_RUNTIME_ENTRY }]
  },
  optimizeDeps: {
    exclude: ['cesium']
  },
  server: {
    port: 5173,
    host: true
  }
});
