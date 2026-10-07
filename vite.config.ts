import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const src = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Tests never read .env files: .env.local may point dev builds at production, and a test
  // must never reach it. Tests get the safe defaults (mocks on, emulators on) instead.
  envDir: process.env.VITEST ? false : undefined,
  resolve: { alias: { '@': src } },
  build: {
    // The Firebase SDK (auth + firestore + functions) is ~540 kB minified / 160 kB gzipped on its
    // own and cannot be split further; everything else stays well under the default 500 kB.
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        // The Firebase SDK changes rarely: its own chunk caches across dashboard deploys.
        advancedChunks: {
          groups: [
            { name: 'firebase', test: /node_modules[\\/](@firebase|firebase)[\\/]/ },
            {
              name: 'motion',
              test: /node_modules[\\/](motion|framer-motion|motion-dom|motion-utils)[\\/]/,
            },
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|react-router|scheduler|@tanstack|zustand)[\\/]/,
            },
          ],
        },
      },
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          globals: true,
          include: ['src/**/*.test.{ts,tsx}'],
          setupFiles: ['src/test/setup.ts'],
        },
      },
      {
        // Firestore rules against the emulator. Run via `npm run test:rules`, which starts it.
        extends: true,
        test: {
          name: 'rules',
          environment: 'node',
          globals: true,
          include: ['tests/rules/**/*.test.ts'],
          fileParallelism: false,
          testTimeout: 15_000,
          hookTimeout: 30_000,
        },
      },
      {
        // Callables end to end on the Auth + Firestore + Functions emulators. `npm run test:emulator`.
        extends: true,
        test: {
          name: 'integration',
          environment: 'node',
          globals: true,
          include: ['tests/integration/**/*.test.ts'],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
