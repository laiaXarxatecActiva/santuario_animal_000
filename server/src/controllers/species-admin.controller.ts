import { idParamsSchema, speciesBodySchema } from '@sanctuary/shared';
import type { RequestHandler } from 'express';
import { diferencias } from '../dominio/actividad.js';
import { validated } from '../middlewares/validate.js';
import { sinRegistro, type ActivityLogService } from '../services/activity-log.service.js';
import type { SpeciesAdminService } from '../servicios/species-admin.service.js';

// CU-30: solo llaman al caso de uso y anotan la actividad (CU-42).
export function createSpeciesAdminController(
  service: SpeciesAdminService,
  actividad: ActivityLogService = sinRegistro,
) {
  const id = (res: Parameters<RequestHandler>[1]) => validated(res, 'params', idParamsSchema).id;

  const list: RequestHandler = async (_req, res) => {
    res.json(await service.list());
  };
  const create: RequestHandler = async (req, res) => {
    const especie = await service.create(validated(res, 'body', speciesBodySchema));
    await actividad.log(req.user!.id, 'create', 'species', especie.id, { name: especie.name });
    res.status(201).json(especie);
  };
  const update: RequestHandler = async (req, res) => {
    const antes = (await service.list()).data.find((e) => e.id === id(res));
    const especie = await service.update(id(res), validated(res, 'body', speciesBodySchema));
    await actividad.log(req.user!.id, 'update', 'species', especie.id, antes ? diferencias(antes, especie) : null);
    res.json(especie);
  };
  const remove: RequestHandler = async (req, res) => {
    await service.remove(id(res));
    await actividad.log(req.user!.id, 'delete', 'species', id(res));
    res.status(204).end();
  };
  return { list, create, update, remove };
}
