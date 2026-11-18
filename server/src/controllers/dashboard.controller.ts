import type { RequestHandler } from 'express';
import { UnauthorizedError } from '../errors/app-error.js';
import type { DashboardService } from '../servicios/dashboard.service.js';

// CU-27: solo llama al caso de uso.
export function createDashboardController(service: DashboardService) {
  const get: RequestHandler = async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    res.json(await service.get(req.user.role));
  };
  return { get };
}
