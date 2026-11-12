import { adminAnimalsQuerySchema, animalBodySchema, animalStatusBodySchema, idParamsSchema } from '@sanctuary/shared';
import type { RequestHandler } from 'express';
import { validated } from '../middlewares/validate.js';
import type { AnimalAdminService } from '../servicios/animal-admin.service.js';

// CU-28: solo llaman al caso de uso.
export function createAnimalAdminController(service: AnimalAdminService) {
  const id = (res: Parameters<RequestHandler>[1]) => validated(res, 'params', idParamsSchema).id;

  const list: RequestHandler = async (_req, res) => {
    res.json(await service.list(validated(res, 'query', adminAnimalsQuerySchema)));
  };
  const get: RequestHandler = async (_req, res) => {
    res.json(await service.get(id(res)));
  };
  const create: RequestHandler = async (_req, res) => {
    res.status(201).json(await service.create(validated(res, 'body', animalBodySchema)));
  };
  const update: RequestHandler = async (_req, res) => {
    res.json(await service.update(id(res), validated(res, 'body', animalBodySchema)));
  };
  const changeStatus: RequestHandler = async (_req, res) => {
    res.json(await service.changeStatus(id(res), validated(res, 'body', animalStatusBodySchema)));
  };
  const remove: RequestHandler = async (_req, res) => {
    await service.remove(id(res));
    res.status(204).end();
  };
  return { list, get, create, update, changeStatus, remove };
}
