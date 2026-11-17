import { idParamsSchema, notificationPatchSchema, notificationsQuerySchema } from '@sanctuary/shared';
import { Router } from 'express';
import { createNotificationController } from '../controllers/notification.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import type { NotificationService } from '../servicios/notification.service.js';

// Campana de cualquier usuario autenticado (TECH_SPEC §10.5), montada en /api.
export function createNotificationRoutes(service: NotificationService): Router {
  const c = createNotificationController(service);
  const router = Router();

  router.get('/me/notifications', requireAuth, validate({ query: notificationsQuerySchema }), c.list);
  router.post('/me/notifications/read-all', requireAuth, c.readAll);
  router.patch(
    '/me/notifications/:id',
    requireAuth,
    validate({ params: idParamsSchema, body: notificationPatchSchema }),
    c.update,
  );
  router.delete('/me/notifications/:id', requireAuth, validate({ params: idParamsSchema }), c.remove);

  return router;
}
