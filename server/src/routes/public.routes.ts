import { catalogQuerySchema, idParamsSchema, paginationQuerySchema } from '@sanctuary/shared';
import { Router } from 'express';
import { createPublicController } from '../controllers/public.controller.js';
import { validate } from '../middlewares/validate.js';
import type { PublicCatalogService } from '../servicios/public-catalog.service.js';

// Web pública (TECH_SPEC §10.3). Sin autenticación.
export function createPublicRoutes(service: PublicCatalogService): Router {
  const c = createPublicController(service);
  const router = Router();

  router.get('/home', c.home);
  router.get('/animals', validate({ query: catalogQuerySchema }), c.listAnimals);
  router.get('/animals/:id', validate({ params: idParamsSchema }), c.getAnimal);
  router.get('/animals/:id/updates', validate({ params: idParamsSchema, query: paginationQuerySchema }), c.listUpdates);
  router.get('/species', c.listSpecies);
  router.get('/plans', c.listPlans);

  return router;
}
