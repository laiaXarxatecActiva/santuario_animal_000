import { adminUserPatchSchema, adminUsersQuerySchema, idParamsSchema, workerCreateSchema } from '@sanctuary/shared';
import type { RequestHandler } from 'express';
import { UnauthorizedError } from '../errors/app-error.js';
import { cambio } from '../dominio/actividad.js';
import { validated } from '../middlewares/validate.js';
import { sinRegistro, type ActivityLogService } from '../services/activity-log.service.js';
import type { UserAdminService } from '../servicios/user-admin.service.js';

// CU-35 y CU-36: solo llaman al caso de uso y anotan la actividad (CU-42).
export function createUserAdminController(service: UserAdminService, actividad: ActivityLogService = sinRegistro) {
  const id = (res: Parameters<RequestHandler>[1]) => validated(res, 'params', idParamsSchema).id;

  const list: RequestHandler = async (_req, res) => {
    res.json(await service.list(validated(res, 'query', adminUsersQuerySchema)));
  };
  const get: RequestHandler = async (_req, res) => {
    res.json(await service.get(id(res)));
  };
  const update: RequestHandler = async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const antes = await service.get(id(res));
    const usuario = await service.update(req.user.id, id(res), validated(res, 'body', adminUserPatchSchema));
    await actividad.log(req.user.id, 'update', 'users', usuario.id, {
      status: cambio(antes.status, usuario.status),
      role: cambio(antes.role, usuario.role),
    });
    res.json(usuario);
  };
  const create: RequestHandler = async (req, res) => {
    const trabajador = await service.createWorker(validated(res, 'body', workerCreateSchema));
    await actividad.log(req.user!.id, 'create', 'users', trabajador.id, { role: trabajador.role });
    res.status(201).json(trabajador);
  };
  const resendInvitation: RequestHandler = async (req, res) => {
    await service.resendInvitation(id(res));
    await actividad.log(req.user!.id, 'update', 'users', id(res), { invitationResent: true });
    res.status(204).end();
  };
  return { list, get, update, create, resendInvitation };
}
