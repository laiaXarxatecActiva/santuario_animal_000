import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./tests/setup.ts'],
    // Las pruebas de integración comparten la base de datos de pruebas y la
    // reinician antes de cada archivo, así que los archivos van de uno en uno.
    fileParallelism: false,
  },
});
