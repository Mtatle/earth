import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@earthly/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@earthly/shared/': `${path.resolve(__dirname, '../../packages/shared/src')}/`
    }
  },
  test: {
    environment: 'node',
    globals: true
  }
});
