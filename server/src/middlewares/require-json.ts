import type { RequestHandler } from 'express';
import { UnsupportedMediaTypeError } from '../errors/app-error.js';

const METODOS_QUE_MODIFICAN = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Protección CSRF junto con `sameSite=lax` (TECH_SPEC §13): las peticiones que
 * modifican datos solo se aceptan con `Content-Type: application/json`, que un
 * formulario de otra web no puede enviar. Las subidas `multipart` (CU-29)
 * exigen además la cabecera `X-Requested-With`, que tampoco puede añadir un
 * formulario de otra web.
 */
export const requireJson: RequestHandler = (req, _res, next) => {
  if (!METODOS_QUE_MODIFICAN.has(req.method)) {
    next();
    return;
  }
  const tipo = req.headers['content-type']?.split(';')[0]?.trim().toLowerCase();
  const subida = tipo === 'multipart/form-data' && Boolean(req.headers['x-requested-with']);
  next(tipo === 'application/json' || subida ? undefined : new UnsupportedMediaTypeError());
};
