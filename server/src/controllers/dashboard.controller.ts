import type { RequestHandler } from 'express';
import type { DashboardService } from '../servicios/dashboard.service.js';

// CU-27: solo llama al caso de uso.
export function createDashboardController(service: DashboardService) {
  const get: RequestHandler = async (_req, res) => {
    res.json(await service.get());
  };
  return { get };
}
