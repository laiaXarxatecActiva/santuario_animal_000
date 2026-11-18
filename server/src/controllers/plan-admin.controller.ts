import { idParamsSchema, planCreateBodySchema, planUpdateBodySchema } from '@sanctuary/shared';
import type { RequestHandler } from 'express';
import { diferencias } from '../dominio/actividad.js';
import { validated } from '../middlewares/validate.js';
import { sinRegistro, type ActivityLogService } from '../services/activity-log.service.js';
import type { PlanAdminService } from '../servicios/plan-admin.service.js';

// CU-40: solo llaman al caso de uso y anotan la actividad (CU-42).
export function createPlanAdminController(service: PlanAdminService, actividad: ActivityLogService = sinRegistro) {
  const list: RequestHandler = async (_req, res) => {
    res.json(await service.list());
  };
  const create: RequestHandler = async (req, res) => {
    const plan = await service.create(validated(res, 'body', planCreateBodySchema));
    await actividad.log(req.user!.id, 'create', 'adoption_plans', plan.id, {
      name: plan.name,
      monthlyAmount: plan.monthlyAmount,
    });
    res.status(201).json(plan);
  };
  const update: RequestHandler = async (req, res) => {
    const { id } = validated(res, 'params', idParamsSchema);
    const antes = (await service.list()).data.find((p) => p.id === id);
    const plan = await service.update(id, validated(res, 'body', planUpdateBodySchema));
    await actividad.log(req.user!.id, 'update', 'adoption_plans', id, antes ? diferencias(antes, plan) : null);
    res.json(plan);
  };
  return { list, create, update };
}
