import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError, NotFoundError } from '../errors/app-error.js';

// Cualquier ruta de la API que no existe responde con 404 en el formato estándar.
export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new NotFoundError());
};

interface ErrorHandlerOptions {
  /** Registra los errores inesperados (500). */
  logError?: (error: unknown) => void;
}

// Convierte cualquier error al formato `{ error: { code, message, details } }`.
export function createErrorHandler(options: ErrorHandlerOptions = {}): ErrorRequestHandler {
  const logError = options.logError ?? ((error: unknown) => console.error(error));

  return (error: unknown, _req, res, _next) => {
    if (error instanceof AppError) {
      res.status(error.status).json({
        error: { code: error.code, message: error.message, details: error.details },
      });
      return;
    }

    // JSON mal formado o cuerpo demasiado grande (errores de express.json).
    if (isBodyParserError(error)) {
      const tooLarge = error.status === 413;
      res.status(error.status).json({
        error: {
          code: tooLarge ? 'PAYLOAD_TOO_LARGE' : 'INVALID_JSON',
          message: tooLarge ? 'La petición es demasiado grande.' : 'El cuerpo de la petición no es JSON válido.',
          details: [],
        },
      });
      return;
    }

    // Error inesperado: sin detalles técnicos en la respuesta.
    logError(error);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Algo ha ido mal; inténtalo de nuevo.', details: [] },
    });
  };
}

function isBodyParserError(error: unknown): error is { status: 400 | 413; type: string } {
  if (typeof error !== 'object' || error === null) return false;
  const { status, type } = error as { status?: unknown; type?: unknown };
  return (status === 400 || status === 413) && typeof type === 'string';
}
