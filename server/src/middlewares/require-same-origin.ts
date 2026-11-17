import type { RequestHandler } from 'express';
import { OriginNotAllowedError } from '../errors/app-error.js';

const METODOS_QUE_MODIFICAN = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Protección CSRF, junto con `sameSite=lax` y `requireJson` (TECH_SPEC §13): las
 * peticiones que modifican datos se rechazan si el navegador indica que vienen
 * de otro origen (`Origin`) o de otro sitio (`Sec-Fetch-Site: cross-site`). Sin
 * esas cabeceras (clientes que no son navegadores) la petición sigue, porque no
 * llevan la cookie de una víctima.
 */
export function createRequireSameOrigin(origenesPermitidos: string[]): RequestHandler {
  const permitidos = new Set(origenesPermitidos.map((url) => new URL(url).origin));
  return (req, _res, next) => {
    if (!METODOS_QUE_MODIFICAN.has(req.method)) {
      next();
      return;
    }
    const origen = req.headers.origin;
    const otroSitio = req.headers['sec-fetch-site'] === 'cross-site';
    next(otroSitio || (origen !== undefined && !permitidos.has(origen)) ? new OriginNotAllowedError() : undefined);
  };
}
