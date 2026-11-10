import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// En desarrollo, Vite reenvía /api y /uploads a la API (mismo origen para la cookie de sesión).
const API_URL = 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': API_URL,
      '/uploads': API_URL,
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
});
