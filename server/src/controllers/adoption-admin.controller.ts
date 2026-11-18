import {
  adminAdoptionCreateSchema,
  adminAdoptionsQuerySchema,
  adminAdoptionStatusSchema,
  idParamsSchema,
} from '@sanctuary/shared';
import type { RequestHandler } from 'express';
import { UnauthorizedError } from '../errors/app-error.js';
import { validated } from '../middlewares/validate.js';
import type { AdoptionAdminService } from '../servicios/adoption-admin.service.js';

// CU-37: solo llaman al caso de uso.
export function createAdoptionAdminController(service: AdoptionAdminService) {
  const id = (res: Parameters<RequestHandler>[1]) => validated(res, 'params', idParamsSchema).id;

  const list: RequestHandler = async (_req, res) => {
    res.json(await service.list(validated(res, 'query', adminAdoptionsQuerySchema)));
  };
  const get: RequestHandler = async (_req, res) => {
    res.json(await service.get(id(res)));
  };
  const create: RequestHandler = async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    res.status(201).json(await service.create(req.user, validated(res, 'body', adminAdoptionCreateSchema)));
  };
  const changeStatus: RequestHandler = async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    res.json(await service.changeStatus(req.user, id(res), validated(res, 'body', adminAdoptionStatusSchema)));
  };
  return { list, get, create, changeStatus };
}
