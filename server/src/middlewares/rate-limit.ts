import type { Request, RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { TooManyRequestsError } from '../errors/app-error.js';

const MINUTO_MS = 60 * 1000;

const rechazar: RequestHandler = (_req, _res, next) => next(new TooManyRequestsError());

function emailDelCuerpo(req: Request): string {
  const body: unknown = req.body;
  if (typeof body !== 'object' || body === null || !('email' in body)) return '';
  return typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
}

/** CU-09 3c: 5 intentos fallidos de login por IP y email cada 15 minutos (TECH_SPEC §9.2). */
export function createLoginLimiter(): RequestHandler {
  return rateLimit({
    windowMs: 15 * MINUTO_MS,
    limit: 5,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? '')}|${emailDelCuerpo(req)}`,
    handler: rechazar,
  });
}

/** CU-08 A1: como máximo 3 reenvíos del email de verificación por hora y usuario. Va después de requireAuth. */
export function createResendVerificationLimiter(): RequestHandler {
  return rateLimit({
    windowMs: 60 * MINUTO_MS,
    limit: 3,
    skipFailedRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => `usuario:${req.user?.id ?? ''}`,
    handler: rechazar,
  });
}

/** CU-24: 5 intentos fallidos de cambio de contraseña por usuario cada 15 minutos. Va después de requireAuth. */
export function createChangePasswordLimiter(): RequestHandler {
  return rateLimit({
    windowMs: 15 * MINUTO_MS,
    limit: 5,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => `usuario:${req.user?.id ?? ''}`,
    handler: rechazar,
  });
}
