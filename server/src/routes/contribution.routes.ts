import { contributionsQuerySchema, idParamsSchema } from '@sanctuary/shared';
import { Router } from 'express';
import { createContributionController } from '../controllers/contribution.controller.js';
import { requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import type { ContributionService } from '../servicios/contribution.service.js';

// CU-19 (TECH_SPEC §10.4), montada en /api.
export function createContributionRoutes(service: ContributionService): Router {
  const c = createContributionController(service);
  const router = Router();
  const conId = validate({ params: idParamsSchema });
  router.get('/me/contributions', requireRole('adopter'), validate({ query: contributionsQuerySchema }), c.list);
  router.get('/me/payments/:id/receipt', requireRole('adopter'), conId, c.paymentReceipt);
  router.get('/me/donations/:id/receipt', requireRole('adopter'), conId, c.donationReceipt);
  return router;
}
