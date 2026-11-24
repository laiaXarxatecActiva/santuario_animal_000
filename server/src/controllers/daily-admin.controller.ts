import {
  alertSettingsBodySchema,
  handoverNoteBodySchema,
  idParamsSchema,
  incidentBodySchema,
  incidentStatusBodySchema,
  incidentsQuerySchema,
  oneOffTaskBodySchema,
  type AlertSettingsDto,
} from '@sanctuary/shared';
import type { RequestHandler } from 'express';
import { cambio, diferencias, type DetallesActividad } from '../dominio/actividad.js';
import { ValidationError } from '../errors/app-error.js';
import { archivosSubidos } from '../middlewares/upload.js';
import { validated } from '../middlewares/validate.js';
import { sinRegistro, type ActivityLogService } from '../services/activity-log.service.js';
import type { HandoverService } from '../servicios/handover.service.js';
import type { IncidentService } from '../servicios/incident.service.js';
import type { TodayService } from '../servicios/today.service.js';
import type { AlertSettingsService } from '../servicios/alert-settings.service.js';

type Res = Parameters<RequestHandler>[1];
const id = (res: Res) => validated(res, 'params', idParamsSchema).id;

/** Cambios de los ajustes de los avisos como `{ campo: [antes, después] }` (las listas, enteras). */
function cambiosDeAvisos(antes: AlertSettingsDto, despues: AlertSettingsDto): DetallesActividad {
  const detalles: DetallesActividad = diferencias(antes, despues);
  if (antes.emailAlertTypes.join() !== despues.emailAlertTypes.join()) {
    detalles.emailAlertTypes = [antes.emailAlertTypes, despues.emailAlertTypes];
  }
  return detalles;
}

export interface DailyAdminServices {
  incidents: IncidentService;
  handover: HandoverService;
  today: TodayService;
  alertSettings: AlertSettingsService;
}

// CU-70 a CU-74: solo llaman al caso de uso y anotan la actividad (CU-42). Las
// notas de relevo no van al registro (como completar una tarea).
export function createDailyAdminController(s: DailyAdminServices, actividad: ActivityLogService = sinRegistro) {
  return {
    listIncidents: (async (_req, res) => {
      res.json(await s.incidents.list(validated(res, 'query', incidentsQuerySchema)));
    }) satisfies RequestHandler,
    incidentSummary: (async (_req, res) => {
      res.json(await s.incidents.summary());
    }) satisfies RequestHandler,
    getIncident: (async (_req, res) => {
      res.json(await s.incidents.get(id(res)));
    }) satisfies RequestHandler,
    createIncident: (async (req, res) => {
      const archivos = archivosSubidos(req);
      if (archivos.length > 1) throw new ValidationError([{ field: 'files', message: 'Adjunta una sola foto.' }]);
      const incidencia = await s.incidents.create(
        validated(res, 'body', incidentBodySchema),
        req.user!.id,
        archivos[0],
      );
      await actividad.log(req.user!.id, 'create', 'incidents', incidencia.id, {
        severity: incidencia.severity,
        zone: incidencia.zone?.name ?? null,
        animal: incidencia.animal?.name ?? null,
      });
      res.status(201).json(incidencia);
    }) satisfies RequestHandler,
    setIncidentStatus: (async (req, res) => {
      const datos = validated(res, 'body', incidentStatusBodySchema);
      const { antes, despues } = await s.incidents.setStatus(id(res), datos, req.user!.id);
      await actividad.log(req.user!.id, 'update', 'incidents', despues.id, {
        status: cambio(antes.status, despues.status),
        note: datos.note ?? undefined,
      });
      res.json(despues);
    }) satisfies RequestHandler,
    createIncidentTask: (async (req, res) => {
      const { incident, task, antes } = await s.incidents.createTask(
        id(res),
        validated(res, 'body', oneOffTaskBodySchema),
        req.user!.id,
      );
      await actividad.log(req.user!.id, 'create', 'task_instances', task.id, {
        title: task.title,
        dueDate: task.dueDate,
        incidentId: incident.id,
      });
      if (antes.status !== incident.status) {
        await actividad.log(req.user!.id, 'update', 'incidents', incident.id, {
          status: cambio(antes.status, incident.status),
        });
      }
      res.status(201).json({ incident, task });
    }) satisfies RequestHandler,

    listNotes: (async (req, res) => {
      res.json(await s.handover.list(req.user!));
    }) satisfies RequestHandler,
    createNote: (async (req, res) => {
      res.status(201).json(await s.handover.create(req.user!, validated(res, 'body', handoverNoteBodySchema)));
    }) satisfies RequestHandler,
    readNote: (async (req, res) => {
      res.json(await s.handover.markRead(req.user!, id(res)));
    }) satisfies RequestHandler,

    today: (async (_req, res) => {
      res.json(await s.today.get());
    }) satisfies RequestHandler,

    alertSettings: (async (_req, res) => {
      res.json(await s.alertSettings.get());
    }) satisfies RequestHandler,
    updateAlertSettings: (async (req, res) => {
      const antes = await s.alertSettings.get();
      const despues = await s.alertSettings.update(validated(res, 'body', alertSettingsBodySchema), req.user!.id);
      await actividad.log(req.user!.id, 'update', 'work_settings', 1, cambiosDeAvisos(antes, despues));
      res.json(despues);
    }) satisfies RequestHandler,
  };
}
