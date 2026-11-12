import { WORKER_ROLES } from '@sanctuary/shared';
import { Router } from 'express';
import { createDashboardController } from '../controllers/dashboard.controller.js';
import { requireRole } from '../middlewares/auth.js';
import type { DashboardService } from '../servicios/dashboard.service.js';

export interface AdminRoutesDeps {
  dashboard: DashboardService;
}

// Panel del personal (TECH_SPEC §10.6), montado en /api/admin.
export function createAdminRoutes(deps: AdminRoutesDeps): Router {
  const router = Router();
  router.use(requireRole(...WORKER_ROLES));

  router.get('/dashboard', createDashboardController(deps.dashboard).get);

  return router;
}
