import express, { type Express } from 'express';
import { createErrorHandler, notFoundHandler } from './middlewares/error-handler.js';

interface AppOptions {
  logError?: (error: unknown) => void;
}

// Configuración de Express sin `listen`, para que Supertest pueda importarla.
export function createApp(options: AppOptions = {}): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api', notFoundHandler);
  app.use(createErrorHandler(options));

  return app;
}
