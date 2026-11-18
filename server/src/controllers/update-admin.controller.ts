import {
  adminUpdatesQuerySchema,
  idParamsSchema,
  updateCreateBodySchema,
  updateEditBodySchema,
} from '@sanctuary/shared';
import type { Request, RequestHandler } from 'express';
import { archivosSubidos } from '../middlewares/upload.js';
import { validated } from '../middlewares/validate.js';
import { sinRegistro, type ActivityLogService } from '../services/activity-log.service.js';
import type { Trabajador, UpdateAdminService } from '../servicios/update-admin.service.js';

// CU-31 y CU-32: solo llaman al caso de uso y anotan la actividad (CU-42).
export function createUpdateAdminController(service: UpdateAdminService, actividad: ActivityLogService = sinRegistro) {
  const id = (res: Parameters<RequestHandler>[1]) => validated(res, 'params', idParamsSchema).id;
  // requireRole ya ha comprobado que hay un trabajador con sesión.
  const usuario = (req: Request): Trabajador => ({ id: req.user!.id, role: req.user!.role });

  const list: RequestHandler = async (req, res) => {
    res.json(await service.list(validated(res, 'query', adminUpdatesQuerySchema), usuario(req)));
  };
  const get: RequestHandler = async (req, res) => {
    res.json(await service.get(id(res), usuario(req)));
  };
  const create: RequestHandler = async (req, res) => {
    const datos = validated(res, 'body', updateCreateBodySchema);
    const creada = await service.create(datos, archivosSubidos(req), usuario(req));
    await actividad.log(req.user!.id, 'create', 'animal_updates', creada.id, {
      animalId: datos.animalId,
      title: datos.title,
      visibility: datos.visibility,
    });
    res.status(201).json(creada);
  };
  const update: RequestHandler = async (req, res) => {
    const datos = validated(res, 'body', updateEditBodySchema);
    const editada = await service.update(id(res), datos, archivosSubidos(req), usuario(req));
    await actividad.log(req.user!.id, 'update', 'animal_updates', id(res), {
      title: datos.title,
      visibility: datos.visibility,
      removedPhotos: datos.removePhotoIds.length > 0 ? datos.removePhotoIds : undefined,
    });
    res.json(editada);
  };
  const remove: RequestHandler = async (req, res) => {
    await service.remove(id(res), usuario(req));
    await actividad.log(req.user!.id, 'delete', 'animal_updates', id(res));
    res.status(204).end();
  };
  return { list, get, create, update, remove };
}
