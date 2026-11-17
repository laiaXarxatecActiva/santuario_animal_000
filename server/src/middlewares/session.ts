import type { Request, RequestHandler } from 'express';
import session, { Store, type SessionData } from 'express-session';
import type { Pool } from 'pg';
import * as sessionModel from '../models/session.model.js';

declare module 'express-session' {
  interface SessionData {
    /** La sesión solo guarda el id del usuario (TECH_SPEC §9.1). */
    userId: number;
  }
}

const SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;
const UN_DIA_MS = 24 * 60 * 60 * 1000;
const QUINCE_MINUTOS_MS = 15 * 60 * 1000;

/**
 * Nombre de la cookie de sesión. En producción lleva el prefijo `__Host-`: el
 * navegador solo la acepta con `Secure`, `Path=/` y sin `Domain`, así que no la
 * puede fijar ni sobrescribir un subdominio ni una conexión sin HTTPS.
 */
export const sessionCookieName = (secure: boolean) => (secure ? '__Host-sid' : 'sid');

/** Opciones de la cookie, también para borrarla al cerrar sesión. Sin `Domain`. */
export const cookieOptions = (secure: boolean) => ({ httpOnly: true, sameSite: 'lax' as const, secure, path: '/' });

export interface SessionOptions {
  pool: Pool;
  secret: string;
  /** `true` en producción (HTTPS): cookie `Secure` y con prefijo `__Host-`. */
  secure: boolean;
  /** Borra periódicamente las sesiones caducadas (desactivado en las pruebas). */
  prune: boolean;
  /** Registra los fallos del borrado periódico. */
  logError?: (error: unknown) => void;
}

/**
 * Store de express-session en PostgreSQL (`user_sessions`). El modelo guarda
 * solo el SHA-256 del identificador y comprueba la caducidad en el servidor.
 */
class PgSessionStore extends Store {
  constructor(private readonly pool: Pool) {
    super();
  }

  private static caducidad(sesion: SessionData): Date {
    return sesion.cookie.expires ? new Date(sesion.cookie.expires) : new Date(Date.now() + UN_DIA_MS);
  }

  override get(sid: string, callback: (err: unknown, session?: SessionData | null) => void): void {
    sessionModel.find(this.pool, sid).then(
      (sess) => callback(null, sess as SessionData | null),
      (error: unknown) => callback(error),
    );
  }

  override set(sid: string, sesion: SessionData, callback?: (err?: unknown) => void): void {
    sessionModel.save(this.pool, sid, { ...sesion }, PgSessionStore.caducidad(sesion)).then(
      () => callback?.(),
      (error: unknown) => callback?.(error),
    );
  }

  override touch(sid: string, sesion: SessionData, callback?: (err?: unknown) => void): void {
    sessionModel.touch(this.pool, sid, PgSessionStore.caducidad(sesion)).then(
      () => callback?.(),
      (error: unknown) => callback?.(error),
    );
  }

  override destroy(sid: string, callback?: (err?: unknown) => void): void {
    sessionModel.destroy(this.pool, sid).then(
      () => callback?.(),
      (error: unknown) => callback?.(error),
    );
  }
}

// Sesiones en PostgreSQL con la cookie `sid` / `__Host-sid` (TECH_SPEC §9.1).
export function createSessionMiddleware({ pool, secret, secure, prune, logError }: SessionOptions): RequestHandler {
  if (prune) {
    const borrarCaducadas = () => {
      sessionModel.deleteExpired(pool).catch((error: unknown) => logError?.(error));
    };
    setInterval(borrarCaducadas, QUINCE_MINUTOS_MS).unref();
  }
  return session({
    name: sessionCookieName(secure),
    secret,
    store: new PgSessionStore(pool),
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
