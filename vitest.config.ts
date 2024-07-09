// <reference types="vitest" />
// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./tests/testExtensions.ts'],
    // Enable coverage
    coverage: {
      enabled: true, // Enable coverage reports
      provider: 'v8',
      reportsDirectory: 'coverage', // Directory to output coverage reports
      reporter: ['text', 'html', 'json-summary'], // Coverage report formats
    },
  },
});
