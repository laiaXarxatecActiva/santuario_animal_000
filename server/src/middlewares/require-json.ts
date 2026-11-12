import type { RequestHandler } from 'express';
import { UnsupportedMediaTypeError } from '../errors/app-error.js';

const METODOS_QUE_MODIFICAN = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Protección CSRF junto con `sameSite=lax` (TECH_SPEC §13): las peticiones que
 * modifican datos solo se aceptan con `Content-Type: application/json`, que un
 * formulario de otra web no puede enviar. Las subidas `multipart` llegarán con
 * CU-29 y exigirán la cabecera `X-Requested-With`.
 */
export const requireJson: RequestHandler = (req, _res, next) => {
  if (!METODOS_QUE_MODIFICAN.has(req.method)) {
    next();
    return;
  }
  const tipo = req.headers['content-type']?.split(';')[0]?.trim().toLowerCase();
  next(tipo === 'application/json' ? undefined : new UnsupportedMediaTypeError());
};
