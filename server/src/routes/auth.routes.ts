import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema, tokenSchema } from '@sanctuary/shared';
import { Router } from 'express';
import { createAuthController } from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { createLoginLimiter, createResendVerificationLimiter } from '../middlewares/rate-limit.js';
import { validate } from '../middlewares/validate.js';
import type { AuthService } from '../servicios/auth.service.js';

// Autenticación (TECH_SPEC §10.2), montada en /api/auth.
export function createAuthRoutes(service: AuthService, options: { secureCookies: boolean }): Router {
  const c = createAuthController(service, options);
  const router = Router();

  router.post('/register', validate({ body: registerSchema }), c.register);
  router.post('/verify-email', validate({ body: tokenSchema }), c.verifyEmail);
  router.post('/resend-verification', requireAuth, createResendVerificationLimiter(), c.resendVerification);
  router.post('/login', createLoginLimiter(), validate({ body: loginSchema }), c.login);
  router.post('/logout', requireAuth, c.logout);
  router.get('/me', c.me);
  router.post('/forgot-password', validate({ body: forgotPasswordSchema }), c.forgotPassword);
  router.post('/reset-password', validate({ body: resetPasswordSchema }), c.resetPassword);

  return router;
}
