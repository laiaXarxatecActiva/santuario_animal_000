import express, { type Express } from 'express';
import type { Logger } from 'pino';
import { pinoHttp } from 'pino-http';
import type { Queryable } from './db/pool.js';
import type { Reloj } from './dominio/reloj.js';
import { createErrorHandler, notFoundHandler } from './middlewares/error-handler.js';
import { createPublicRoutes } from './routes/public.routes.js';
import { createPublicCatalogService } from './servicios/public-catalog.service.js';

export interface AppOptions {
  db: Queryable;
  reloj: Reloj;
  /** Carpeta de los archivos subidos, servida en `/uploads`. */
  uploadsDir: string;
  /** Registra las peticiones y los errores inesperados. */
  logger?: Logger;
  /** Sustituye el registro de errores inesperados (500). */
  logError?: (error: unknown) => void;
}

// Configuración de Express sin `listen`, para que Supertest pueda importarla.
export function createApp(options: AppOptions): Express {
  const { db, reloj, uploadsDir, logger } = options;
  const app = express();

  app.disable('x-powered-by');
  if (logger) {
    app.use(pinoHttp({ logger }));
  }
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/api', createPublicRoutes(createPublicCatalogService({ db, reloj })));

  // Los errores de cliente de express.static (archivo inexistente, ruta
  // maliciosa) siguen adelante y terminan en el 404 estándar.
  app.use('/uploads', express.static(uploadsDir, { index: false, dotfiles: 'deny' }));

  app.use(['/api', '/uploads'], notFoundHandler);
  app.use(
    createErrorHandler({
      logError: options.logError ?? (logger ? (error) => logger.error({ err: error }, 'Error inesperado') : undefined),
    }),
  );

  return app;
}
