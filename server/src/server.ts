import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createApp } from './app.js';
import { loadConfig } from './config/env.js';
import { createPool } from './db/pool.js';
import { relojSistema } from './dominio/reloj.js';
import { createEmailService, createSmtpMailer } from './services/email/email.service.js';
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
const mailer = createSmtpMailer({
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  user: config.SMTP_USER,
  password: config.SMTP_PASSWORD,
});
const app = createApp({
  db: createPool(config.DATABASE_URL),
  reloj: relojSistema,
  uploadsDir: resolve(serverDir, config.UPLOADS_DIR),
  sessionSecret: config.SESSION_SECRET,
  clientUrl: config.CLIENT_URL,
  email: createEmailService({ mailer, from: config.MAIL_FROM }),
  production: config.NODE_ENV === 'production',
  pruneSessions: true,
  logger,
});

app.listen(config.PORT, () => {
  logger.info(`API escuchando en http://localhost:${config.PORT} (${config.NODE_ENV})`);
});
