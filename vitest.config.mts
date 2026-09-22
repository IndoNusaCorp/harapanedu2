import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      'server-only': path.resolve(import.meta.dirname, './src/test/empty-module.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
    // Fixed, fake config so results never depend on the developer's .env or machine
    env: {
      TZ: 'Asia/Jakarta',
      NEXT_PUBLIC_FIREBASE_API_KEY: 'test-api-key',
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo-harapanedu.firebaseapp.com',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-harapanedu',
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'demo-harapanedu.firebasestorage.app',
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
      NEXT_PUBLIC_FIREBASE_APP_ID: '1:000000000000:web:test',
      LIBRAAI_API_KEY: 'test-libra-key',
      LIBRAAI_VOICE_API_KEY: 'test-libra-voice-key',
      SCORPIOAI_API_KEY: 'test-scorpio-key',
    },
    // Each test starts with fresh mocks, env and globals
    mockReset: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
});
