import { historyQuerySchema } from '@sanctuary/shared';
import { Router } from 'express';
import { createHistoryController } from '../controllers/history.controller.js';
import { requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import type { HistoryService } from '../servicios/history.service.js';

// Historial del adoptante (CU-15, TECH_SPEC §10.4), montado en /api.
export function createHistoryRoutes(service: HistoryService): Router {
  const c = createHistoryController(service);
  const router = Router();
  router.get('/me/history', requireRole('adopter'), validate({ query: historyQuerySchema }), c.list);
  return router;
}
