import { changePasswordSchema, updateProfileSchema } from '@sanctuary/shared';
import { Router } from 'express';
import { createProfileController } from '../controllers/profile.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { createChangePasswordLimiter } from '../middlewares/rate-limit.js';
import { validate } from '../middlewares/validate.js';
import type { ProfileService } from '../servicios/profile.service.js';

// Perfil de cualquier usuario autenticado (TECH_SPEC §10.4), montado en /api.
export function createProfileRoutes(service: ProfileService): Router {
  const c = createProfileController(service);
  const router = Router();

  router.get('/me/profile', requireAuth, c.get);
  router.patch('/me/profile', requireAuth, validate({ body: updateProfileSchema }), c.update);
  router.put(
    '/me/password',
    requireAuth,
    createChangePasswordLimiter(),
    validate({ body: changePasswordSchema }),
    c.changePassword,
  );

  return router;
}
