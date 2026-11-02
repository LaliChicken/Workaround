import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { scheduleApi } from './server/vitePlugin.ts';

// Relative base so the static build works from any folder or sub-path.
// scheduleApi() adds the local /api/schedule-import endpoint to dev and preview.
export default defineConfig({
  base: './',
  // The schedule endpoint isn't needed (and shouldn't call Anthropic) while running tests.
  plugins: [react(), ...(process.env.VITEST ? [] : [scheduleApi()])],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
  },
});
