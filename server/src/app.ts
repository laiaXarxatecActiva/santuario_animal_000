import express, { type Express } from 'express';
import type { Logger } from 'pino';
import { pinoHttp } from 'pino-http';
import { createErrorHandler, notFoundHandler } from './middlewares/error-handler.js';

interface AppOptions {
  /** Registra las peticiones y los errores inesperados. */
  logger?: Logger;
  /** Sustituye el registro de errores inesperados (500). */
  logError?: (error: unknown) => void;
}

// Configuración de Express sin `listen`, para que Supertest pueda importarla.
export function createApp(options: AppOptions = {}): Express {
  const { logger } = options;
  const app = express();

  app.disable('x-powered-by');
  if (logger) {
    app.use(pinoHttp({ logger }));
  }
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api', notFoundHandler);
  app.use(
    createErrorHandler({
      logError: options.logError ?? (logger ? (error) => logger.error({ err: error }, 'Error inesperado') : undefined),
    }),
  );

  return app;
}
