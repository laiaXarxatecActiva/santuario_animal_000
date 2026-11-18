import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  // En desarrollo, Vite reenvía /api y /uploads a la API (mismo origen para la cookie de sesión).
  // Las pruebas extremo a extremo (e2e/) arrancan su propia API en otro puerto y la indican
  // con API_PROXY_TARGET; sin esa variable, la API de `npm run dev`.
  const apiUrl = loadEnv(mode, '.', 'API_PROXY_').API_PROXY_TARGET ?? 'http://localhost:3000';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': apiUrl,
        '/uploads': apiUrl,
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts'],
    },
  };
});
