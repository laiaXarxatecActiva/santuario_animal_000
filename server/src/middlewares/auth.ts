import type { Role, SessionUser } from '@sanctuary/shared';
import type { RequestHandler } from 'express';
import { EmailNotVerifiedError, ForbiddenError, UnauthorizedError } from '../errors/app-error.js';

declare module 'express-serve-static-core' {
  interface Request {
    /** Usuario de la sesión, releído de la base de datos en cada petición (loadUser). */
    user?: SessionUser;
  }
}

/**
 * Carga el usuario de la sesión. Si ya no existe o su cuenta no está activa,
 * la petición sigue como visitante (TECH_SPEC §9.1).
 */
export function createLoadUser(findUser: (id: number) => Promise<SessionUser | null>): RequestHandler {
  return async (req, _res, next) => {
    const userId = req.session.userId;
    if (userId !== undefined) {
      req.user = (await findUser(userId)) ?? undefined;
    }
    next();
  };
}

/** 401 si no hay sesión válida. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  next(req.user ? undefined : new UnauthorizedError());
};

/** 401 sin sesión; 403 si el rol no es uno de los indicados. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) next(new UnauthorizedError());
    else next(roles.includes(req.user.role) ? undefined : new ForbiddenError());
  };
}

/** 403 si el email no está verificado (RN-21, TECH_SPEC §18 punto 3). */
export const requireVerifiedEmail: RequestHandler = (req, _res, next) => {
  if (!req.user) next(new UnauthorizedError());
  else next(req.user.emailVerified ? undefined : new EmailNotVerifiedError());
};
