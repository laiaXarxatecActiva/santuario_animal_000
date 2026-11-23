import {
  adminTasksQuerySchema,
  idParamsSchema,
  myDayQuerySchema,
  oneOffTaskBodySchema,
  qualificationBodySchema,
  taskAssigneeBodySchema,
  taskCompleteBodySchema,
  taskNotDoneBodySchema,
  taskTemplateBodySchema,
  userQualificationsBodySchema,
  workSettingsBodySchema,
  zoneBodySchema,
} from '@sanctuary/shared';
import type { RequestHandler } from 'express';
import { diferencias } from '../dominio/actividad.js';
import { ValidationError } from '../errors/app-error.js';
import { archivosSubidos } from '../middlewares/upload.js';
import { validated } from '../middlewares/validate.js';
import { sinRegistro, type ActivityLogService } from '../services/activity-log.service.js';
import type { TaskTemplateAdminService } from '../servicios/task-template-admin.service.js';
import type { TaskService } from '../servicios/task.service.js';
import type { ZoneAdminService } from '../servicios/zone-admin.service.js';

type Res = Parameters<RequestHandler>[1];
const id = (res: Res) => validated(res, 'params', idParamsSchema).id;

// CU-52 y CU-53: solo llaman al caso de uso y anotan la actividad (CU-42).
export function createZoneAdminController(service: ZoneAdminService, actividad: ActivityLogService = sinRegistro) {
  return {
    listZones: (async (_req, res) => {
      res.json(await service.listZones());
    }) satisfies RequestHandler,
    createZone: (async (req, res) => {
      const zona = await service.createZone(validated(res, 'body', zoneBodySchema));
      await actividad.log(req.user!.id, 'create', 'zones', zona.id, { name: zona.name });
      res.status(201).json(zona);
    }) satisfies RequestHandler,
    updateZone: (async (req, res) => {
      const antes = await service.getZone(id(res));
      const zona = await service.updateZone(id(res), validated(res, 'body', zoneBodySchema));
      await actividad.log(req.user!.id, 'update', 'zones', zona.id, diferencias(antes, zona));
      res.json(zona);
    }) satisfies RequestHandler,
    removeZone: (async (req, res) => {
      const antes = await service.getZone(id(res));
      await service.removeZone(id(res));
      await actividad.log(req.user!.id, 'delete', 'zones', antes.id, { name: antes.name });
      res.status(204).end();
    }) satisfies RequestHandler,

    listQualifications: (async (_req, res) => {
      res.json(await service.listQualifications());
    }) satisfies RequestHandler,
    createQualification: (async (req, res) => {
      const q = await service.createQualification(validated(res, 'body', qualificationBodySchema));
      await actividad.log(req.user!.id, 'create', 'qualifications', q.id, { name: q.name });
      res.status(201).json(q);
    }) satisfies RequestHandler,
    updateQualification: (async (req, res) => {
      const antes = await service.getQualification(id(res));
      const q = await service.updateQualification(id(res), validated(res, 'body', qualificationBodySchema));
      await actividad.log(req.user!.id, 'update', 'qualifications', q.id, diferencias(antes, q));
      res.json(q);
    }) satisfies RequestHandler,
    removeQualification: (async (req, res) => {
      const antes = await service.getQualification(id(res));
      await service.removeQualification(id(res));
      await actividad.log(req.user!.id, 'delete', 'qualifications', antes.id, { name: antes.name });
      res.status(204).end();
    }) satisfies RequestHandler,

    getUserQualifications: (async (_req, res) => {
      res.json(await service.getOfUser(id(res)));
    }) satisfies RequestHandler,
    setUserQualifications: (async (req, res) => {
      const { qualificationIds } = validated(res, 'body', userQualificationsBodySchema);
      const { before, ...resultado } = await service.setOfUser(id(res), qualificationIds);
      await actividad.log(req.user!.id, 'update', 'users', resultado.userId, {
        qualifications: [before.map((q) => q.name).join(', '), resultado.qualifications.map((q) => q.name).join(', ')],
      });
      res.json(resultado);
    }) satisfies RequestHandler,
  };
}

// CU-54.
export function createTaskTemplateAdminController(
  service: TaskTemplateAdminService,
  actividad: ActivityLogService = sinRegistro,
) {
  return {
    list: (async (_req, res) => {
      res.json(await service.list());
    }) satisfies RequestHandler,
    get: (async (_req, res) => {
      res.json(await service.get(id(res)));
    }) satisfies RequestHandler,
    create: (async (req, res) => {
      const plantilla = await service.create(validated(res, 'body', taskTemplateBodySchema), req.user!.id);
      await actividad.log(req.user!.id, 'create', 'task_templates', plantilla.id, {
        type: plantilla.type,
        title: plantilla.title,
      });
      res.status(201).json(plantilla);
    }) satisfies RequestHandler,
    update: (async (req, res) => {
      const antes = await service.get(id(res));
      const plantilla = await service.update(id(res), validated(res, 'body', taskTemplateBodySchema));
      await actividad.log(req.user!.id, 'update', 'task_templates', plantilla.id, diferencias(antes, plantilla));
      res.json(plantilla);
    }) satisfies RequestHandler,
    remove: (async (req, res) => {
      const plantilla = await service.remove(id(res));
      await actividad.log(req.user!.id, 'delete', 'task_templates', plantilla.id, { title: plantilla.title });
      res.status(204).end();
    }) satisfies RequestHandler,
  };
}

// CU-55 a CU-57 y CU-73.
export function createTaskController(service: TaskService, actividad: ActivityLogService = sinRegistro) {
  return {
    myDay: (async (req, res) => {
      res.json(await service.myDay(req.user!, validated(res, 'query', myDayQuerySchema).date));
    }) satisfies RequestHandler,
    list: (async (_req, res) => {
      res.json(await service.list(validated(res, 'query', adminTasksQuerySchema)));
    }) satisfies RequestHandler,
    complete: (async (req, res) => {
      const archivos = archivosSubidos(req);
      if (archivos.length > 1) throw new ValidationError([{ field: 'files', message: 'Adjunta una sola foto.' }]);
      const { observations } = validated(res, 'body', taskCompleteBodySchema);
      res.json(await service.complete(req.user!, id(res), observations ?? null, archivos[0]));
    }) satisfies RequestHandler,
    notDone: (async (req, res) => {
      res.json(await service.notDone(req.user!, id(res), validated(res, 'body', taskNotDoneBodySchema).reason));
    }) satisfies RequestHandler,
    reopen: (async (req, res) => {
      res.json(await service.reopen(req.user!, id(res)));
    }) satisfies RequestHandler,
    create: (async (req, res) => {
      const tarea = await service.createOneOff(validated(res, 'body', oneOffTaskBodySchema), req.user!.id);
      await actividad.log(req.user!.id, 'create', 'task_instances', tarea.id, {
        title: tarea.title,
        dueDate: tarea.dueDate,
        assignedTo: tarea.assignedTo?.name ?? null,
      });
      res.status(201).json(tarea);
    }) satisfies RequestHandler,
    setAssignee: (async (req, res) => {
      const { userId } = validated(res, 'body', taskAssigneeBodySchema);
      const { antes, despues } = await service.setAssignee(id(res), userId);
      await actividad.log(req.user!.id, 'update', 'task_instances', despues.id, {
        assignedTo: [antes.assignedTo?.name ?? null, despues.assignedTo?.name ?? null],
      });
      res.json(despues);
    }) satisfies RequestHandler,
    remove: (async (req, res) => {
      const tarea = await service.remove(id(res));
      await actividad.log(req.user!.id, 'delete', 'task_instances', tarea.id, {
        title: tarea.title,
        dueDate: tarea.dueDate,
      });
      res.status(204).end();
    }) satisfies RequestHandler,
    settings: (async (_req, res) => {
      res.json(await service.settings());
    }) satisfies RequestHandler,
    updateSettings: (async (req, res) => {
      const antes = await service.settings();
      const ajustes = await service.updateSettings(validated(res, 'body', workSettingsBodySchema), req.user!.id);
      await actividad.log(req.user!.id, 'update', 'work_settings', 1, diferencias(antes, ajustes));
      res.json(ajustes);
    }) satisfies RequestHandler,
  };
}
