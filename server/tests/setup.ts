// Carga el .env de la raíz (si existe) y fuerza el entorno de pruebas.
try {
  process.loadEnvFile(new URL('../../.env', import.meta.url));
} catch {
  // Sin .env se usan las variables del entorno.
}

process.env.NODE_ENV = 'test';
process.env.JOBS_ENABLED = 'false';
process.env.PAYMENT_SIMULATION_MODE = 'always_succeed';
