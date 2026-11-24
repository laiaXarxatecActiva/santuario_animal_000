import {
  dietItemBodySchema,
  idParamsSchema,
  medicationPlanBodySchema,
  vetRecordBodySchema,
  vetVisitBodySchema,
} from '@sanctuary/shared';
import type { RequestHandler } from 'express';
import { diferencias } from '../dominio/actividad.js';
import { validated } from '../middlewares/validate.js';
import { sinRegistro, type ActivityLogService } from '../services/activity-log.service.js';
import type { CareService } from '../servicios/care.service.js';

type Res = Parameters<RequestHandler>[1];
const id = (res: Res) => validated(res, 'params', idParamsSchema).id;

// CU-65 a CU-69: solo llaman al caso de uso y anotan la actividad (CU-42). Lo
// que se anota al completar tareas (comidas, dosis) no va al registro.
export function createCareAdminController(service: CareService, actividad: ActivityLogService = sinRegistro) {
  return {
    get: (async (_req, res) => {
      res.json(await service.get(id(res)));
    }) satisfies RequestHandler,

    createDietItem: (async (req, res) => {
      const item = await service.createDietItem(id(res), validated(res, 'body', dietItemBodySchema), req.user!.id);
      await actividad.log(req.user!.id, 'create', 'diet_items', item.id, { animalId: item.animalId, food: item.food });
      res.status(201).json(item);
    }) satisfies RequestHandler,
    updateDietItem: (async (req, res) => {
      const antes = await service.getDietItem(id(res));
      const item = await service.updateDietItem(id(res), validated(res, 'body', dietItemBodySchema));
      await actividad.log(req.user!.id, 'update', 'diet_items', item.id, diferencias(antes, item));
      res.json(item);
    }) satisfies RequestHandler,
    removeDietItem: (async (req, res) => {
      const item = await service.removeDietItem(id(res));
      await actividad.log(req.user!.id, 'delete', 'diet_items', item.id, { animalId: item.animalId, food: item.food });
      res.status(204).end();
    }) satisfies RequestHandler,

    createPlan: (async (req, res) => {
      const plan = await service.createPlan(id(res), validated(res, 'body', medicationPlanBodySchema), req.user!.id);
      await actividad.log(req.user!.id, 'create', 'medication_plans', plan.id, {
        animalId: plan.animalId,
        medication: plan.medication,
        dose: plan.dose,
      });
      res.status(201).json(plan);
    }) satisfies RequestHandler,
    updatePlan: (async (req, res) => {
      const antes = await service.getPlan(id(res));
      const plan = await service.updatePlan(id(res), validated(res, 'body', medicationPlanBodySchema));
      await actividad.log(req.user!.id, 'update', 'medication_plans', plan.id, diferencias(antes, plan));
      res.json(plan);
    }) satisfies RequestHandler,
    endPlan: (async (req, res) => {
      const plan = await service.endPlan(id(res));
      await actividad.log(req.user!.id, 'update', 'medication_plans', plan.id, { endDate: plan.endDate });
      res.json(plan);
    }) satisfies RequestHandler,
    removePlan: (async (req, res) => {
      const plan = await service.removePlan(id(res));
      await actividad.log(req.user!.id, 'delete', 'medication_plans', plan.id, {
        animalId: plan.animalId,
        medication: plan.medication,
      });
      res.status(204).end();
    }) satisfies RequestHandler,

    createVisit: (async (req, res) => {
      const visita = await service.createVisit(id(res), validated(res, 'body', vetVisitBodySchema), req.user!.id);
      await actividad.log(req.user!.id, 'create', 'vet_visits', visita.id, {
        animalId: visita.animalId,
        date: visita.date,
        time: visita.time,
      });
      res.status(201).json(visita);
    }) satisfies RequestHandler,
    updateVisit: (async (req, res) => {
      const antes = await service.getVisit(id(res));
      const visita = await service.updateVisit(id(res), validated(res, 'body', vetVisitBodySchema), req.user!.id);
      const { taskId: _a, ...sinTareaAntes } = antes;
      const { taskId: _d, ...sinTarea } = visita;
      await actividad.log(req.user!.id, 'update', 'vet_visits', visita.id, diferencias(sinTareaAntes, sinTarea));
      res.json(visita);
    }) satisfies RequestHandler,
    cancelVisit: (async (req, res) => {
      const visita = await service.cancelVisit(id(res));
      await actividad.log(req.user!.id, 'update', 'vet_visits', visita.id, { status: 'cancelled' });
      res.json(visita);
    }) satisfies RequestHandler,
    completeVisit: (async (req, res) => {
      const visita = await service.completeVisit(req.user!, id(res), validated(res, 'body', vetRecordBodySchema));
      await actividad.log(req.user!.id, 'update', 'vet_visits', visita.id, {
        status: 'done',
        vetRecordId: visita.vetRecordId,
      });
      res.json(visita);
    }) satisfies RequestHandler,
  };
}
