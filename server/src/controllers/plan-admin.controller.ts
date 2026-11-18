import { idParamsSchema, planCreateBodySchema, planUpdateBodySchema } from '@sanctuary/shared';
import type { RequestHandler } from 'express';
import { validated } from '../middlewares/validate.js';
import type { PlanAdminService } from '../servicios/plan-admin.service.js';

// CU-40: solo llaman al caso de uso.
export function createPlanAdminController(service: PlanAdminService) {
  const list: RequestHandler = async (_req, res) => {
    res.json(await service.list());
  };
  const create: RequestHandler = async (_req, res) => {
    res.status(201).json(await service.create(validated(res, 'body', planCreateBodySchema)));
  };
  const update: RequestHandler = async (_req, res) => {
    const { id } = validated(res, 'params', idParamsSchema);
    res.json(await service.update(id, validated(res, 'body', planUpdateBodySchema)));
  };
  return { list, create, update };
}
