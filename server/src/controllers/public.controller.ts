import { catalogQuerySchema, idParamsSchema, paginationQuerySchema } from '@sanctuary/shared';
import type { RequestHandler } from 'express';
import { validated } from '../middlewares/validate.js';
import type { PublicCatalogService } from '../servicios/public-catalog.service.js';

// Controladores de la web pública: solo llaman al caso de uso.
export function createPublicController(service: PublicCatalogService) {
  const home: RequestHandler = async (_req, res) => {
    res.json(await service.getHome());
  };

  const listAnimals: RequestHandler = async (_req, res) => {
    res.json(await service.listCatalog(validated(res, 'query', catalogQuerySchema)));
  };

  const getAnimal: RequestHandler = async (_req, res) => {
    res.json(await service.getAnimal(validated(res, 'params', idParamsSchema).id));
  };

  const listUpdates: RequestHandler = async (_req, res) => {
    const { id } = validated(res, 'params', idParamsSchema);
    res.json(await service.listUpdates(id, validated(res, 'query', paginationQuerySchema)));
  };

  const listSpecies: RequestHandler = async (_req, res) => {
    res.json({ data: await service.listSpecies() });
  };

  const listPlans: RequestHandler = async (_req, res) => {
    res.json({ data: await service.listPlans() });
  };

  return { home, listAnimals, getAnimal, listUpdates, listSpecies, listPlans };
}
