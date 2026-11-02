import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { scheduleApi } from './server/vitePlugin';

// Relative base so the static build works from any folder or sub-path.
// scheduleApi() adds the local /api/schedule-import endpoint to dev and preview.
export default defineConfig({
  base: './',
  plugins: [react(), scheduleApi()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
  },
});
