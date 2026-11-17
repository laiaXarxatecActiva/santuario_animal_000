import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createApp } from './app.js';
import { jobsEnabled, loadConfig } from './config/env.js';
import { createJobDeps } from './jobs/job-deps.js';
import { createJobRunner } from './jobs/registry.js';
import { startScheduler } from './jobs/scheduler.js';
import { createLogger } from './utils/logger.js';

// Carga el .env de la raíz del proyecto si existe (Node 22+).
try {
  process.loadEnvFile(new URL('../../.env', import.meta.url));
} catch {
  // Sin .env se usan las variables del entorno y los valores por defecto.
}

const config = loadConfig();
const logger = createLogger(config.NODE_ENV);
const serverDir = fileURLToPath(new URL('..', import.meta.url));
const deps = createJobDeps(config, (error, contexto) => logger.error({ err: error }, contexto));
// Las tareas programadas y las lanzadas desde el panel comparten el ejecutor.
const jobs = createJobRunner(deps, {
  info: ({ job, result }) => logger.info({ job, result }, `Tarea ${job} terminada`),
});
const app = createApp({
  db: deps.db,
  reloj: deps.reloj,
  uploadsDir: resolve(serverDir, config.UPLOADS_DIR),
  sessionSecret: config.SESSION_SECRET,
  clientUrl: config.CLIENT_URL,
  email: deps.email,
  payments: deps.payments,
  production: config.NODE_ENV === 'production',
  pruneSessions: true,
  logger,
  jobs,
});

app.listen(config.PORT, () => {
  logger.info(`API escuchando en http://localhost:${config.PORT} (${config.NODE_ENV})`);
  if (jobsEnabled(config)) {
    startScheduler(jobs, (error, job) => logger.error({ err: error, job }, `La tarea ${job} ha fallado`));
    logger.info('Tareas programadas activas (Europe/Madrid)');
  }
});
