import { changePasswordSchema, deleteAccountSchema, updateProfileSchema } from '@sanctuary/shared';
import { Router } from 'express';
import { createProfileController } from '../controllers/profile.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { createChangePasswordLimiter } from '../middlewares/rate-limit.js';
import { validate } from '../middlewares/validate.js';
import type { ProfileService } from '../servicios/profile.service.js';

// Perfil de cualquier usuario autenticado (TECH_SPEC §10.4), montado en /api.
export function createProfileRoutes(
  service: ProfileService,
  opciones: { secureCookies: boolean } = { secureCookies: false },
): Router {
  const c = createProfileController(service, opciones);
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

  // CU-25: solo adoptantes (1a); la contraseña tiene el mismo límite de intentos que CU-24.
  router.delete(
    '/me',
    requireAuth,
    requireRole('adopter'),
    createChangePasswordLimiter(),
    validate({ body: deleteAccountSchema }),
    c.deleteAccount,
  );

  return router;
}
