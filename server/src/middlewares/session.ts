import connectPgSimple from 'connect-pg-simple';
import type { Request, RequestHandler } from 'express';
import session from 'express-session';
import type { Pool } from 'pg';

declare module 'express-session' {
  interface SessionData {
    /** La sesión solo guarda el id del usuario (TECH_SPEC §9.1). */
    userId: number;
  }
}

export const SESSION_COOKIE = 'sid';
const SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

export interface SessionOptions {
  pool: Pool;
  secret: string;
  /** `true` en producción (HTTPS). */
  secure: boolean;
  /** Borra periódicamente las sesiones caducadas (desactivado en las pruebas). */
  prune: boolean;
}

/** Opciones de la cookie, también para borrarla al cerrar sesión. */
export const cookieOptions = (secure: boolean) => ({ httpOnly: true, sameSite: 'lax' as const, secure, path: '/' });

// Sesiones en PostgreSQL (tabla `user_sessions`) con la cookie `sid` (TECH_SPEC §9.1).
export function createSessionMiddleware({ pool, secret, secure, prune }: SessionOptions): RequestHandler {
  const PgStore = connectPgSimple(session);
  return session({
    name: SESSION_COOKIE,
    secret,
    store: new PgStore({
      pool,
      tableName: 'user_sessions',
      createTableIfMissing: false,
      pruneSessionInterval: prune ? 15 * 60 : false,
    }),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { ...cookieOptions(secure), maxAge: SIETE_DIAS_MS },
  });
}

/** Nuevo identificador de sesión al iniciar sesión (evita la fijación de sesión). */
export function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error: unknown) => (error ? reject(error) : resolve()));
  });
}

export function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.destroy((error: unknown) => (error ? reject(error) : resolve()));
  });
}
