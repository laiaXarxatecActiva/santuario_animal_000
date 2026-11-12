import { createAdoptionSchema, idParamsSchema, myAdoptionsQuerySchema, payAdoptionSchema } from '@sanctuary/shared';
import { Router } from 'express';
import { createAdoptionController } from '../controllers/adoption.controller.js';
import { requireAuth, requireRole, requireVerifiedEmail } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import type { AdoptionService } from '../servicios/adoption.service.js';

// Área del adoptante: adopción y pago (TECH_SPEC §10.4), montada en /api.
export function createAdoptionRoutes(service: AdoptionService): Router {
  const c = createAdoptionController(service);
  const router = Router();

  // El caso del trabajador (RN-03) lo resuelve el servicio, con su propio mensaje.
  router.post('/adoptions', requireAuth, requireVerifiedEmail, validate({ body: createAdoptionSchema }), c.create);
  router.get('/me/adoptions', requireRole('adopter'), validate({ query: myAdoptionsQuerySchema }), c.listMine);
  router.get('/me/adoptions/:id', requireRole('adopter'), validate({ params: idParamsSchema }), c.getMine);
  router.post(
    '/me/adoptions/:id/pay',
    requireRole('adopter'),
    validate({ params: idParamsSchema, body: payAdoptionSchema }),
    c.pay,
  );

  return router;
}
