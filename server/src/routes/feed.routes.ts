import { feedQuerySchema, updateIdParamsSchema } from '@sanctuary/shared';
import { Router } from 'express';
import { createFeedController } from '../controllers/feed.controller.js';
import { requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import type { FeedService } from '../servicios/feed.service.js';

// Muro del adoptante (TECH_SPEC §10.4), montado en /api.
export function createFeedRoutes(service: FeedService): Router {
  const c = createFeedController(service);
  const router = Router();
  const soloAdoptantes = requireRole('adopter');

  router.get('/me/feed', soloAdoptantes, validate({ query: feedQuerySchema }), c.list);
  router.put('/me/feed/:updateId/read', soloAdoptantes, validate({ params: updateIdParamsSchema }), c.markRead);
  router.delete('/me/feed/:updateId/read', soloAdoptantes, validate({ params: updateIdParamsSchema }), c.markUnread);

  return router;
}
