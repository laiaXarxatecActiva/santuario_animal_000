import { adminUserPatchSchema, adminUsersQuerySchema, idParamsSchema, workerCreateSchema } from '@sanctuary/shared';
import type { RequestHandler } from 'express';
import { UnauthorizedError } from '../errors/app-error.js';
import { validated } from '../middlewares/validate.js';
import type { UserAdminService } from '../servicios/user-admin.service.js';

// CU-35 y CU-36: solo llaman al caso de uso.
export function createUserAdminController(service: UserAdminService) {
  const id = (res: Parameters<RequestHandler>[1]) => validated(res, 'params', idParamsSchema).id;

  const list: RequestHandler = async (_req, res) => {
    res.json(await service.list(validated(res, 'query', adminUsersQuerySchema)));
  };
  const get: RequestHandler = async (_req, res) => {
    res.json(await service.get(id(res)));
  };
  const update: RequestHandler = async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    res.json(await service.update(req.user.id, id(res), validated(res, 'body', adminUserPatchSchema)));
  };
  const create: RequestHandler = async (_req, res) => {
    res.status(201).json(await service.createWorker(validated(res, 'body', workerCreateSchema)));
  };
  const resendInvitation: RequestHandler = async (_req, res) => {
    await service.resendInvitation(id(res));
    res.status(204).end();
  };
  return { list, get, update, create, resendInvitation };
}
