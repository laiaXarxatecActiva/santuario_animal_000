import { idParamsSchema, speciesBodySchema } from '@sanctuary/shared';
import type { RequestHandler } from 'express';
import { validated } from '../middlewares/validate.js';
import type { SpeciesAdminService } from '../servicios/species-admin.service.js';

// CU-30: solo llaman al caso de uso.
export function createSpeciesAdminController(service: SpeciesAdminService) {
  const id = (res: Parameters<RequestHandler>[1]) => validated(res, 'params', idParamsSchema).id;

  const list: RequestHandler = async (_req, res) => {
    res.json(await service.list());
  };
  const create: RequestHandler = async (_req, res) => {
    res.status(201).json(await service.create(validated(res, 'body', speciesBodySchema)));
  };
  const update: RequestHandler = async (_req, res) => {
    res.json(await service.update(id(res), validated(res, 'body', speciesBodySchema)));
  };
  const remove: RequestHandler = async (_req, res) => {
    await service.remove(id(res));
    res.status(204).end();
  };
  return { list, create, update, remove };
}
