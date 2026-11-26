import type {
  AdminTasksQuery,
  MyDayDto,
  MyDayTaskDto,
  OneOffTaskData,
  SessionUser,
  TaskBlockReason,
  TaskDto,
  WorkSettingsData,
  WorkSettingsDto,
} from '@sanctuary/shared';
import { isWorkerRole, RECENT_TASKS_LIMIT } from '@sanctuary/shared';
import type { Pool } from 'pg';
import type { Queryable } from '../db/pool.js';
import { withTransaction } from '../db/transaction.js';
import { completarIngestas, esIngestaBaja, type Ingesta } from '../dominio/cuidados.js';
import { fechaEnZonaSantuario, instanteEnZonaSantuario, type Reloj } from '../dominio/reloj.js';
import { asignadaAOtraPersona, comprobarResolucion } from '../dominio/tareas.js';
import { esDeMiTurno } from '../dominio/turnos.js';
import {
  ForbiddenError,
  MissingQualificationError,
  NotFoundError,
  TaskFutureDayError,
  TaskIsPendingError,
  TaskNotPendingError,
  TaskNotYoursError,
  ValidationError,
  VetVisitNeedsRecordError,
  IncidentHasTaskError,
} from '../errors/app-error.js';
import * as feedingModel from '../models/feeding-log.model.js';
import * as qualificationModel from '../models/qualification.model.js';
import * as assignmentModel from '../models/shift-assignment.model.js';
import * as taskModel from '../models/task.model.js';
import * as userModel from '../models/user.model.js';
import * as settingsModel from '../models/work-settings.model.js';
import { avisarSiComePoco } from './avisos-cuidados.js';
import { seguirALaTarea, type TareaQueCambia } from './incidencia-tarea.js';
import { resolverZona } from './task-template-admin.service.js';

/** CU-70: lo que necesita su incidencia para seguir a la tarea. */
const tareaQueCambia = (tarea: TaskDto, observations: string | null): TareaQueCambia => ({
  incidentId: tarea.incidentId ?? null,
  title: tarea.title,
  observations,
});

export interface TaskServiceDeps {
  db: Pool;
  reloj: Reloj;
}

export type TaskService = ReturnType<typeof createTaskService>;

/** RN-40: una tarea asignada a otra persona no se resuelve. */
function lanzarSiAjena(tarea: TaskDto, userId: number): void {
  if (asignadaAOtraPersona(tarea.assignedTo?.id ?? null, userId)) throw new TaskNotYoursError();
}

const noExiste = () => new NotFoundError('Esta tarea no existe.');
const enCampo = (field: string, message: string) => new ValidationError([{ field, message }]);

/** CU-57 2a-2b: cada motivo de bloqueo con su error. */
function lanzarSiBloqueada(motivo: TaskBlockReason | null): void {
  if (motivo === 'NOT_PENDING') throw new TaskNotPendingError();
  if (motivo === 'FUTURE_DAY') throw new TaskFutureDayError();
  if (motivo === 'MISSING_QUALIFICATION') throw new MissingQualificationError();
}

// CU-55 a CU-57 y CU-73: tareas del día, «Mi día» y ajustes.
export function createTaskService({ db, reloj }: TaskServiceDeps) {
  async function contexto(): Promise<taskModel.Contexto> {
    const ajustes = await settingsModel.get(db);
    return { ahora: reloj.ahora(), margenMinutos: ajustes.lateMarginMinutes };
  }

  async function buscar(q: Queryable, id: number, forUpdate = false): Promise<TaskDto> {
    const tarea = await taskModel.findById(q, id, await contexto(), { forUpdate });
    if (!tarea) throw noExiste();
    return tarea;
  }

  const bloqueo = (tarea: TaskDto, cualificaciones: readonly number[]) =>
    comprobarResolucion(
      { status: tarea.status, dueDate: tarea.dueDate, qualificationId: tarea.qualification?.id ?? null },
      cualificaciones,
      reloj.hoy(),
    );

  /**
   * Una persona a quien asignar una tarea: trabajador en activo y, si la tarea
   * exige una cualificación, con ella (CU-55 3a).
   */
  async function validarPersona(campo: string, userId: number, qualificationId: number | null): Promise<void> {
    const user = await userModel.findById(db, userId);
    if (!user || !isWorkerRole(user.role) || !user.isActive) throw enCampo(campo, 'Elige a un trabajador en activo.');
    if (qualificationId !== null && !(await qualificationModel.userHas(db, userId, qualificationId))) {
      throw enCampo(campo, 'Esta persona no tiene la cualificación que exige la tarea.');
    }
  }

  /**
   * CU-66 y CU-68: al completarla, lo que ha comido cada animal (solo en las de
   * alimentación). Una visita veterinaria se completa con su registro.
   */
  function ingestasAlCompletar(tarea: TaskDto, anotadas: readonly Ingesta[]): Ingesta[] {
    if (tarea.vetVisitId) throw new VetVisitNeedsRecordError();
    if (tarea.type !== 'feeding') {
      if (anotadas.length > 0) throw enCampo('intakes', 'Esta tarea no es de alimentación.');
      return [];
    }
    const resultado = completarIngestas(tarea.feedingAnimals ?? [], anotadas);
    if (!resultado.ok) throw enCampo('intakes', 'Este animal no es de esta comida.');
    return resultado.ingestas;
  }

  /** Completa o marca como no realizada (CU-57). */
  async function resolver(
    user: SessionUser,
    id: number,
    datos: {
      status: 'completed' | 'not_done';
      observations: string | null;
      intakes?: readonly Ingesta[];
    },
  ): Promise<TaskDto> {
    const cualificaciones = await qualificationModel.idsOfUser(db, user.id);
    const tarea = await buscar(db, id);
    lanzarSiAjena(tarea, user.id);
    lanzarSiBloqueada(bloqueo(tarea, cualificaciones));
    const ingestas = datos.status === 'completed' ? ingestasAlCompletar(tarea, datos.intakes ?? []) : [];
    await withTransaction(db, async (client) => {
      const actual = await buscar(client, id, true);
      lanzarSiAjena(actual, user.id);
      lanzarSiBloqueada(bloqueo(actual, cualificaciones));
      await taskModel.resolve(client, id, {
        status: datos.status,
        resolvedBy: user.id,
        resolvedAt: reloj.ahora(),
        observations: datos.observations,
      });
      // CU-70: hecha, resuelve su incidencia; no hecha, la vuelve a abrir.
      await seguirALaTarea(client, tareaQueCambia(tarea, datos.observations), datos.status, user.id, reloj.ahora());
      if (ingestas.length === 0) return;
      // CU-66 y CU-67: se anota la comida y se avisa si un animal lleva varias tomas comiendo poco.
      await feedingModel.insertMany(client, id, ingestas, { recordedBy: user.id, recordedAt: reloj.ahora() });
      const { lowIntakeMeals } = await settingsModel.get(client);
      for (const animal of tarea.feedingAnimals ?? []) {
        const ingesta = ingestas.find((i) => i.animalId === animal.id);
        if (!ingesta || !esIngestaBaja(ingesta.intake)) continue;
        await avisarSiComePoco(client, animal, {
          hoy: reloj.hoy(),
          zoneId: tarea.zone?.id ?? null,
          umbral: lowIntakeMeals,
        });
      }
    });
    return buscar(db, id);
  }

  return {
    /** CU-56: las tareas del día con lo que puede hacer quien las mira. */
    async myDay(user: SessionUser, fecha?: string): Promise<MyDayDto> {
      const date = fecha ?? reloj.hoy();
      const [tareas, cualificaciones, turnos] = await Promise.all([
        taskModel.listByDay(db, { date }, await contexto()),
        qualificationModel.idsOfUser(db, user.id),
        assignmentModel.listByRange(db, { from: date, to: date, userId: user.id }),
      ]);
      const franjas = turnos.map((a) => ({
        inicio: a.shift.startTime,
        fin: a.shift.endTime,
        zoneIds: a.zones.map((z) => z.id),
      }));
      // RN-40: las asignadas a otra persona no se ven. Asignada a alguien, solo es suya;
      // si no, de quien tiene turno en su zona a esa hora (CU-56).
      const tasks: MyDayTaskDto[] = tareas
        .filter((tarea) => !asignadaAOtraPersona(tarea.assignedTo?.id ?? null, user.id))
        .map((tarea) => ({
          ...tarea,
          mine: tarea.assignedTo
            ? tarea.assignedTo.id === user.id
            : esDeMiTurno({ zoneId: tarea.zone?.id ?? null, dueTime: tarea.dueTime }, franjas),
          blockedReason: tarea.status === 'pending' ? bloqueo(tarea, cualificaciones) : null,
        }));
      return { date, tasks, shifts: turnos };
    },

    /** CU-55: listado del día para el administrador. */
    async list(query: AdminTasksQuery): Promise<{ data: TaskDto[] }> {
      if (query.sort === '-createdAt') {
        const filtros = { zoneId: query.zoneId, status: query.status, limit: RECENT_TASKS_LIMIT };
        return { data: await taskModel.listRecent(db, filtros, await contexto()) };
      }
      const filtros = { date: query.date ?? reloj.hoy(), zoneId: query.zoneId, status: query.status };
      return { data: await taskModel.listByDay(db, filtros, await contexto()) };
    },

    get: (id: number) => buscar(db, id),

    complete(user: SessionUser, id: number, observations: string | null, intakes: readonly Ingesta[] = []) {
      return resolver(user, id, { status: 'completed', observations, intakes });
    },

    /** A1: el motivo queda en las observaciones. */
    notDone(user: SessionUser, id: number, reason: string) {
      return resolver(user, id, { status: 'not_done', observations: reason });
    },

    /** A2: quien la resolvió, el mismo día; un administrador, siempre. */
    async reopen(user: SessionUser, id: number): Promise<TaskDto> {
      await withTransaction(db, async (client) => {
        const tarea = await buscar(client, id, true);
        if (tarea.status === 'pending') throw new TaskIsPendingError();
        const esSuya =
          tarea.resolvedBy?.id === user.id &&
          tarea.resolvedAt !== null &&
          fechaEnZonaSantuario(new Date(tarea.resolvedAt)) === reloj.hoy();
        if (user.role !== 'admin' && !esSuya) throw new ForbiddenError('Solo quien la resolvió puede deshacerlo.');
        await taskModel.reopen(client, id);
        await seguirALaTarea(client, tareaQueCambia(tarea, null), 'reopened', user.id, reloj.ahora());
      });
      return buscar(db, id);
    },

    /** CU-55 pasos 1-2: tarea puntual (sin plantilla); con `incidentId`, la de una incidencia (CU-70). */
    async createOneOff(datos: OneOffTaskData, autorId: number, incidentId: number | null = null): Promise<TaskDto> {
      if (datos.dueDate < reloj.hoy()) throw enCampo('dueDate', 'No se pueden crear tareas de días pasados.');
      // Zona, animales y persona son opcionales; sin zona elegida, la de sus animales si viven juntos.
      const zona = await resolverZona(db, datos, { sinZonaPermitida: true });
      if (datos.assignedTo !== null) await validarPersona('assignedTo', datos.assignedTo, datos.qualificationId);
      const id = await withTransaction(db, (client) =>
        taskModel.insert(client, {
          templateId: null,
          type: datos.type,
          title: datos.title,
          description: datos.description ?? null,
          zoneId: zona,
          qualificationId: datos.qualificationId,
          dueDate: datos.dueDate,
          dueTime: datos.dueTime,
          dueAt: instanteEnZonaSantuario(datos.dueDate, datos.dueTime),
          assignedTo: datos.assignedTo,
          createdBy: autorId,
          animalIds: datos.animalIds,
          incidentId,
        }),
      );
      // Solo choca con otra tarea pendiente de la misma incidencia.
      if (id === null) throw new IncidentHasTaskError();
      return buscar(db, id);
    },

    /** CU-55 paso 3: reasignar a una persona (o quitar la reasignación). */
    async setAssignee(id: number, userId: number | null): Promise<{ antes: TaskDto; despues: TaskDto }> {
      const antes = await buscar(db, id);
      if (antes.status !== 'pending') throw new TaskNotPendingError();
      if (userId !== null) await validarPersona('userId', userId, antes.qualification?.id ?? null);
      await taskModel.setAssignee(db, id, userId);
      return { antes, despues: await buscar(db, id) };
    },

    /** CU-55 paso 4: solo las pendientes. */
    async remove(id: number): Promise<TaskDto> {
      return withTransaction(db, async (client) => {
        const tarea = await buscar(client, id, true);
        if (tarea.status !== 'pending') throw new TaskNotPendingError();
        await taskModel.remove(client, id);
        await seguirALaTarea(client, tareaQueCambia(tarea, null), 'removed', null, reloj.ahora());
        return tarea;
      });
    },

    /** CU-73. */
    settings: (): Promise<WorkSettingsDto> => settingsModel.get(db),
    updateSettings: (datos: WorkSettingsData, userId: number) => settingsModel.update(db, datos, userId),
  };
}
