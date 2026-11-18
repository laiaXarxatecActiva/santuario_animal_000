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

/**
 * CU-09 3c (TECH_SPEC §9.2): 5 intentos fallidos de login por IP y email cada
 * 15 minutos y, además, 50 por IP sea cual sea el email, para que desde una IP
 * no se pueda probar una contraseña contra muchas cuentas. No hay límite solo
 * por email: permitiría a cualquiera bloquear la cuenta de otra persona.
 */
export function createLoginLimiter(): RequestHandler[] {
  const comun = {
    windowMs: 15 * MINUTO_MS,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: rechazar,
  } as const;
  return [
    rateLimit({ ...comun, limit: 50, keyGenerator: (req) => `ip:${ipKeyGenerator(req.ip ?? '')}` }),
    rateLimit({
      ...comun,
      limit: 5,
      keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? '')}|${emailDelCuerpo(req)}`,
    }),
  ];
}

/**
 * CU-07: como máximo 20 registros por hora desde una IP y 3 por hora con el
 * mismo email. Cada registro envía un email, así que sin límite el formulario
 * serviría para inundar el buzón de otra persona.
 */
export function createRegisterLimiter(): RequestHandler[] {
  const comun = {
    windowMs: 60 * MINUTO_MS,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: rechazar,
  } as const;
  return [
    rateLimit({ ...comun, limit: 20, keyGenerator: (req) => `ip:${ipKeyGenerator(req.ip ?? '')}` }),
    rateLimit({ ...comun, limit: 3, keyGenerator: (req) => `email:${emailDelCuerpo(req)}` }),
  ];
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

/** Límite por IP en una hora, para los formularios públicos que envían emails. */
function porIpYHora(limit: number): RequestHandler {
  return rateLimit({
    windowMs: 60 * MINUTO_MS,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
    handler: rechazar,
  });
}

/** CU-05: 10 donaciones por hora desde una IP (cada una puede enviar un email a cualquier dirección). */
export const createDonationLimiter = (): RequestHandler => porIpYHora(10);

/** CU-06 3b: 5 mensajes de contacto por hora desde una IP. */
export const createContactLimiter = (): RequestHandler => porIpYHora(5);
