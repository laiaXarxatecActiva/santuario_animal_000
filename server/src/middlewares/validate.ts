import type { RequestHandler, Response } from 'express';
import type { z } from 'zod';
import { ValidationError, type ErrorDetail } from '../errors/app-error.js';

type Parte = 'params' | 'query' | 'body';
type Esquemas = Partial<Record<Parte, z.ZodType>>;

/**
 * Valida y convierte `params`, `query` y `body` con Zod. Los datos ya
 * convertidos se guardan en `res.locals` (en Express 5 `req.query` es de solo
 * lectura) y el controlador los lee con `validated()`.
 */
export function validate(esquemas: Esquemas): RequestHandler {
  return (req, res, next) => {
    const detalles: ErrorDetail[] = [];
    const resultado: Partial<Record<Parte, unknown>> = {};

    for (const parte of ['params', 'query', 'body'] as const) {
      const esquema = esquemas[parte];
      if (!esquema) continue;
      const parsed = esquema.safeParse(req[parte] ?? {});
      if (parsed.success) {
        resultado[parte] = parsed.data;
      } else {
        for (const issue of parsed.error.issues) {
          detalles.push({ field: issue.path.join('.'), message: issue.message });
        }
      }
    }

    if (detalles.length > 0) {
      next(new ValidationError(detalles));
      return;
    }
    res.locals.validated = resultado;
    next();
  };
}

/** Datos ya validados por `validate()`; el esquema solo sirve para el tipo. */
export function validated<S extends z.ZodType>(res: Response, parte: Parte, _esquema: S): z.output<S> {
  const datos = res.locals.validated as Partial<Record<Parte, unknown>> | undefined;
  return datos?.[parte] as z.output<S>;
}
