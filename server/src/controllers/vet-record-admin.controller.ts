import { idParamsSchema, vetRecordBodySchema } from '@sanctuary/shared';
import type { RequestHandler } from 'express';
import { diferencias } from '../dominio/actividad.js';
import { validated } from '../middlewares/validate.js';
import { sinRegistro, type ActivityLogService } from '../services/activity-log.service.js';
import type { VetRecordAdminService } from '../servicios/vet-record-admin.service.js';

// CU-34: solo llaman al caso de uso y anotan la actividad (CU-42).
export function createVetRecordAdminController(
  service: VetRecordAdminService,
  actividad: ActivityLogService = sinRegistro,
) {
  const id = (res: Parameters<RequestHandler>[1]) => validated(res, 'params', idParamsSchema).id;

  const list: RequestHandler = async (_req, res) => {
    res.json(await service.list(id(res)));
  };
  const create: RequestHandler = async (req, res) => {
    const registro = await service.create(id(res), validated(res, 'body', vetRecordBodySchema), req.user!.id);
    await actividad.log(req.user!.id, 'create', 'vet_records', registro.id, {
      animalId: registro.animalId,
      type: registro.type,
      recordDate: registro.recordDate,
    });
    res.status(201).json(registro);
  };
  const update: RequestHandler = async (req, res) => {
    const antes = await service.get(id(res));
    const registro = await service.update(id(res), validated(res, 'body', vetRecordBodySchema));
    await actividad.log(req.user!.id, 'update', 'vet_records', registro.id, diferencias(antes, registro));
    res.json(registro);
  };
  const remove: RequestHandler = async (req, res) => {
    const antes = await service.get(id(res));
    await service.remove(id(res));
    await actividad.log(req.user!.id, 'delete', 'vet_records', antes.id, {
      animalId: antes.animalId,
      recordDate: antes.recordDate,
    });
    res.status(204).end();
  };
  return { list, create, update, remove };
}
