import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../..');

  return {
    envDir: '../..',
    plugins: [react()],
    server: {
      host: env.WEB_HOST ?? '127.0.0.1',
      port: Number(env.WEB_PORT ?? 5173),
      proxy: {
        '/api': `http://127.0.0.1:${env.API_PORT ?? '4000'}`,
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      restoreMocks: true,
    },
  };
});
