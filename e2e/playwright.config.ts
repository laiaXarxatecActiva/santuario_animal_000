import { defineConfig, devices } from '@playwright/test';
import { API_PORT, API_URL, RAIZ, WEB_PORT, WEB_URL, testDatabaseUrl } from './support/entorno.js';

// Pruebas extremo a extremo (TECH_SPEC §15): `npm run test:e2e` desde la raíz.
// Arranca su propia API (con la base de datos de pruebas recién cargada) y su
// propio Vite; los correos van a Mailpit, que tiene que estar arrancado.
export default defineConfig({
  testDir: './tests',
  globalSetup: './support/global-setup.ts',
  // Comparten la base de datos de pruebas: de una en una.
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL: WEB_URL,
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      name: 'API',
      // Reinicia la base de datos de pruebas y arranca la API sobre ella.
      command: 'npm run db:reset:test && npm exec -w server -- tsx src/server.ts',
      cwd: RAIZ,
      url: `${API_URL}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
      env: {
        NODE_ENV: 'test',
        PORT: String(API_PORT),
        DATABASE_URL: testDatabaseUrl(),
        CLIENT_URL: WEB_URL,
        JOBS_ENABLED: 'false',
        PAYMENT_SIMULATION_MODE: 'always_succeed',
      },
    },
    {
      name: 'Web',
      command: `npm exec -w client -- vite --port ${WEB_PORT} --strictPort`,
      cwd: RAIZ,
      url: WEB_URL,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
      env: { API_PROXY_TARGET: API_URL },
    },
  ],
});
