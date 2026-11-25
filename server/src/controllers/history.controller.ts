import { historyQuerySchema } from '@sanctuary/shared';
import type { RequestHandler } from 'express';
import { UnauthorizedError } from '../errors/app-error.js';
import { validated } from '../middlewares/validate.js';
import type { HistoryService } from '../servicios/history.service.js';

// CU-15: historial de «Mis animales». Solo llama al caso de uso.
export function createHistoryController(service: HistoryService) {
  const list: RequestHandler = async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    res.json(await service.list(req.user.id, validated(res, 'query', historyQuerySchema)));
  };
  return { list };
}
