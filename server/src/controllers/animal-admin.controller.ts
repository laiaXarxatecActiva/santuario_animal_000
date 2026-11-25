import {
  adminAnimalsQuerySchema,
  animalBodySchema,
  animalMemorialBodySchema,
  animalStatusBodySchema,
  ARCHIVED_ANIMAL_STATUSES,
  idParamsSchema,
} from '@sanctuary/shared';
import type { RequestHandler } from 'express';
import { cambio, diferencias } from '../dominio/actividad.js';
import { validated } from '../middlewares/validate.js';
import { sinRegistro, type ActivityLogService } from '../services/activity-log.service.js';
import type { AnimalAdminService } from '../servicios/animal-admin.service.js';

// CU-28: solo llaman al caso de uso y anotan la actividad (CU-42).
export function createAnimalAdminController(service: AnimalAdminService, actividad: ActivityLogService = sinRegistro) {
  const id = (res: Parameters<RequestHandler>[1]) => validated(res, 'params', idParamsSchema).id;

  const list: RequestHandler = async (_req, res) => {
    res.json(await service.list(validated(res, 'query', adminAnimalsQuerySchema)));
  };
  const get: RequestHandler = async (_req, res) => {
    res.json(await service.get(id(res)));
  };
  const create: RequestHandler = async (req, res) => {
    const animal = await service.create(validated(res, 'body', animalBodySchema));
    await actividad.log(req.user!.id, 'create', 'animals', animal.id, { name: animal.name });
    res.status(201).json(animal);
  };
  const update: RequestHandler = async (req, res) => {
    const antes = await service.get(id(res));
    const animal = await service.update(id(res), validated(res, 'body', animalBodySchema));
    await actividad.log(req.user!.id, 'update', 'animals', animal.id, diferencias(antes, animal));
    res.json(animal);
  };
  const changeStatus: RequestHandler = async (req, res) => {
    const datos = validated(res, 'body', animalStatusBodySchema);
    const antes = await service.get(id(res));
    const animal = await service.changeStatus(id(res), datos, req.user!);
    const archivado = (ARCHIVED_ANIMAL_STATUSES as readonly string[]).includes(animal.status);
    await actividad.log(req.user!.id, archivado ? 'archive' : 'update', 'animals', animal.id, {
      status: cambio(antes.status, animal.status),
      date: datos.date,
    });
    res.json(animal);
  };
  const setMemorial: RequestHandler = async (req, res) => {
    const { showInMemorial } = validated(res, 'body', animalMemorialBodySchema);
    const antes = await service.get(id(res));
    const animal = await service.setMemorial(id(res), showInMemorial);
    await actividad.log(req.user!.id, 'update', 'animals', animal.id, diferencias(antes, animal));
    res.json(animal);
  };
  const remove: RequestHandler = async (req, res) => {
    const antes = await service.get(id(res));
    await service.remove(id(res));
    await actividad.log(req.user!.id, 'delete', 'animals', antes.id, { name: antes.name });
    res.status(204).end();
  };
  return { list, get, create, update, changeStatus, setMemorial, remove };
}
