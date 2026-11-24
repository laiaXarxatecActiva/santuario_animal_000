import { FEEDING_HISTORY_DAYS, type TaskDto, type TodayDto } from '@sanctuary/shared';
import type { Pool } from 'pg';
import { rachaDeComerPoco } from '../dominio/cuidados.js';
import { instanteEnZonaSantuario, type Reloj } from '../dominio/reloj.js';
import { sumarDias } from '../dominio/tareas.js';
import * as feedingModel from '../models/feeding-log.model.js';
import * as incidentModel from '../models/incident.model.js';
import * as assignmentModel from '../models/shift-assignment.model.js';
import * as taskModel from '../models/task.model.js';
import * as visitModel from '../models/vet-visit.model.js';
import * as settingsModel from '../models/work-settings.model.js';
import { huecosDelRango } from './shift.service.js';

export interface TodayServiceDeps {
  db: Pool;
  reloj: Reloj;
}

export type TodayService = ReturnType<typeof createTodayService>;

/** Incidencias activas que se muestran en el panel. */
const INCIDENCIAS_EN_EL_PANEL = 5;
/** Tomas que se miran hacia atrás para calcular la racha de cada animal. */
const TOMAS_REVISADAS = 20;

// CU-72: panel «Hoy» del administrador. Todo se calcula al consultar.
export function createTodayService({ db, reloj }: TodayServiceDeps) {
  return {
    async get(): Promise<TodayDto> {
      const hoy = reloj.hoy();
      const ahora = reloj.ahora();
      const ajustes = await settingsModel.get(db);
      const contexto = { ahora, margenMinutos: ajustes.lateMarginMinutes };

      const tareas = await taskModel.listByDay(db, { date: hoy }, contexto);
      const lateTasks = tareas.filter((t) => t.late);
      const notDoneTasks = tareas.filter((t) => t.status === 'not_done');

      const dosis = await taskModel.listMissedDoses(db, {
        desde: sumarDias(hoy, -1),
        hasta: hoy,
        limite: new Date(ahora.getTime() - ajustes.lateMarginMinutes * 60_000),
      });
      const missedDoses = (await Promise.all(dosis.map((d) => taskModel.findById(db, d.id, contexto)))).filter(
        (t): t is TaskDto => t !== null,
      );

      const recuento = await incidentModel.countByStatus(db);

      const gaps = (await huecosDelRango(db, hoy, hoy)).filter(
        (h) => instanteEnZonaSantuario(h.date, h.shift.endTime) > ahora,
      );
      const shifts = (await assignmentModel.listByRange(db, { from: hoy, to: hoy })).map((assignment) => ({
        assignment,
        missingCheckIn:
          assignment.checkedInAt === null && instanteEnZonaSantuario(hoy, assignment.shift.startTime) <= ahora,
      }));

      const lowIntake: TodayDto['lowIntake'] = [];
      for (const animal of await feedingModel.animalsWithLogsSince(db, sumarDias(hoy, -FEEDING_HISTORY_DAYS))) {
        const racha = rachaDeComerPoco(await feedingModel.recentOfAnimal(db, animal.id, TOMAS_REVISADAS));
        if (racha.longitud >= ajustes.lowIntakeMeals) lowIntake.push({ animal, streak: racha.longitud });
      }

      const vetVisits: TodayDto['vetVisits'] = [];
      for (const v of await visitModel.listScheduledOn(db, hoy)) {
        const visita = await visitModel.findById(db, v.id);
        if (visita) vetVisits.push({ ...visita, animal: { id: v.animalId, name: v.animalName } });
      }

      return {
        date: hoy,
        tasks: {
          total: tareas.length,
          completed: tareas.filter((t) => t.status === 'completed').length,
          notDone: notDoneTasks.length,
          pending: tareas.filter((t) => t.status === 'pending').length,
          late: lateTasks.length,
        },
        lateTasks,
        notDoneTasks,
        missedDoses,
        incidents: {
          open: recuento.open,
          inProgress: recuento.in_progress,
          latest: await incidentModel.listActive(db, INCIDENCIAS_EN_EL_PANEL),
        },
        gaps,
        shifts,
        lowIntake,
        vetVisits,
      };
    },
  };
}
