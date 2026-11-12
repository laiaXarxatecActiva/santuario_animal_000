import {
  adminAnimalsQuerySchema,
  animalBodySchema,
  animalStatusBodySchema,
  idParamsSchema,
  speciesBodySchema,
  WORKER_ROLES,
} from '@sanctuary/shared';
import { Router } from 'express';
import { createAnimalAdminController } from '../controllers/animal-admin.controller.js';
import { createDashboardController } from '../controllers/dashboard.controller.js';
import { createSpeciesAdminController } from '../controllers/species-admin.controller.js';
import { requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import type { AnimalAdminService } from '../servicios/animal-admin.service.js';
import type { DashboardService } from '../servicios/dashboard.service.js';
import type { SpeciesAdminService } from '../servicios/species-admin.service.js';

export interface AdminRoutesDeps {
  dashboard: DashboardService;
  species: SpeciesAdminService;
  animals: AnimalAdminService;
}

// Panel del personal (TECH_SPEC §10.6), montado en /api/admin. Todo exige ser
// trabajador; los borrados, además, administrador.
export function createAdminRoutes(deps: AdminRoutesDeps): Router {
  const router = Router();
  router.use(requireRole(...WORKER_ROLES));
  const soloAdmin = requireRole('admin');
  const conId = validate({ params: idParamsSchema });

  router.get('/dashboard', createDashboardController(deps.dashboard).get);

  const especies = createSpeciesAdminController(deps.species);
  router.get('/species', especies.list);
  router.post('/species', validate({ body: speciesBodySchema }), especies.create);
  router.put('/species/:id', validate({ params: idParamsSchema, body: speciesBodySchema }), especies.update);
  router.delete('/species/:id', soloAdmin, conId, especies.remove);

  const animales = createAnimalAdminController(deps.animals);
  router.get('/animals', validate({ query: adminAnimalsQuerySchema }), animales.list);
  router.post('/animals', validate({ body: animalBodySchema }), animales.create);
  router.get('/animals/:id', conId, animales.get);
  router.put('/animals/:id', validate({ params: idParamsSchema, body: animalBodySchema }), animales.update);
  router.patch(
    '/animals/:id/status',
    validate({ params: idParamsSchema, body: animalStatusBodySchema }),
    animales.changeStatus,
  );
  router.delete('/animals/:id', soloAdmin, conId, animales.remove);

  return router;
}
