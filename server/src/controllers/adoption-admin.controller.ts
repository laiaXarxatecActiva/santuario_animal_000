import {
  adminAdoptionCreateSchema,
  adminAdoptionsQuerySchema,
  adminAdoptionStatusSchema,
  idParamsSchema,
} from '@sanctuary/shared';
import type { RequestHandler } from 'express';
import { UnauthorizedError } from '../errors/app-error.js';
import { cambio } from '../dominio/actividad.js';
import { validated } from '../middlewares/validate.js';
import { sinRegistro, type ActivityLogService } from '../services/activity-log.service.js';
import type { AdoptionAdminService } from '../servicios/adoption-admin.service.js';

// CU-37: solo llaman al caso de uso y anotan la actividad (CU-42).
export function createAdoptionAdminController(
  service: AdoptionAdminService,
  actividad: ActivityLogService = sinRegistro,
) {
  const id = (res: Parameters<RequestHandler>[1]) => validated(res, 'params', idParamsSchema).id;

  const list: RequestHandler = async (_req, res) => {
    res.json(await service.list(validated(res, 'query', adminAdoptionsQuerySchema)));
  };
  const get: RequestHandler = async (_req, res) => {
    res.json(await service.get(id(res)));
  };
  const create: RequestHandler = async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const datos = validated(res, 'body', adminAdoptionCreateSchema);
    const adopcion = await service.create(req.user, datos);
    await actividad.log(req.user.id, 'create', 'adoptions', adopcion.id, {
      manual: true,
      method: datos.method,
      userId: datos.userId,
      animalId: datos.animalId,
      planId: datos.planId,
    });
    res.status(201).json(adopcion);
  };
  const changeStatus: RequestHandler = async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const datos = validated(res, 'body', adminAdoptionStatusSchema);
    const antes = await service.get(id(res));
    const adopcion = await service.changeStatus(req.user, id(res), datos);
    await actividad.log(req.user.id, 'update', 'adoptions', adopcion.id, {
      status: cambio(antes.status, adopcion.status),
      action: datos.action,
      refund: datos.refundLastPayment || undefined,
    });
    res.json(adopcion);
  };
  return { list, get, create, changeStatus };
}
