import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Relative base so the static build works from any folder or sub-path
// (e.g. a project page or a local file server) without extra config.
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
