import { adminStatsQuerySchema } from '@sanctuary/shared';
import type { RequestHandler } from 'express';
import { validated } from '../middlewares/validate.js';
import type { StatsAdminService } from '../servicios/stats-admin.service.js';

// CU-41: solo llama al caso de uso.
export function createStatsAdminController(service: StatsAdminService) {
  const get: RequestHandler = async (_req, res) => {
    res.json(await service.get(validated(res, 'query', adminStatsQuerySchema)));
  };
  return { get };
}
