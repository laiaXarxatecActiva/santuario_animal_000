import { adminActivityLogsQuerySchema } from '@sanctuary/shared';
import type { RequestHandler } from 'express';
import { validated } from '../middlewares/validate.js';
import type { ActivityAdminService } from '../servicios/activity-admin.service.js';

// CU-42: solo llama al caso de uso.
export function createActivityAdminController(service: ActivityAdminService) {
  const list: RequestHandler = async (_req, res) => {
    res.json(await service.list(validated(res, 'query', adminActivityLogsQuerySchema)));
  };
  return { list };
}
