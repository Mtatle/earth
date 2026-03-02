import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // Cesium ships worker modules that Vite's dep optimizer can mis-handle.
    // Excluding it prevents broken /.vite/deps/Workers/* lookups in dev.
    exclude: ['cesium'],
    // Cesium depends on several CommonJS packages via default imports.
    // Prebundling these restores interop while keeping cesium itself excluded.
    include: [
      'autolinker',
      'bitmap-sdf',
      'dompurify',
      'draco3d',
      'earcut',
      'grapheme-splitter',
      'jsep',
      'kdbush',
      'ktx-parse',
      'lerc',
      'mersenne-twister',
      'meshoptimizer',
      'pako',
      'protobufjs',
      'rbush',
      'topojson-client',
      'urijs',
      '@tweenjs/tween.js',
      '@zip.js/zip.js',
      'nosleep.js'
    ]
  },
  server: {
    port: 5173,
    host: true
  }
});
