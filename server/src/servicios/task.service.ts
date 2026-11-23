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
import { isWorkerRole } from '@sanctuary/shared';
import type { Pool } from 'pg';
import type { Queryable } from '../db/pool.js';
import { withTransaction } from '../db/transaction.js';
import type { ArchivoSubido } from '../dominio/fotos.js';
import { fechaEnZonaSantuario, instanteEnZonaSantuario, type Reloj } from '../dominio/reloj.js';
import { comprobarResolucion } from '../dominio/tareas.js';
import {
  ForbiddenError,
  MissingQualificationError,
  NotFoundError,
  TaskFutureDayError,
  TaskIsPendingError,
  TaskNotPendingError,
  ValidationError,
} from '../errors/app-error.js';
import * as qualificationModel from '../models/qualification.model.js';
import * as taskModel from '../models/task.model.js';
import * as userModel from '../models/user.model.js';
import * as settingsModel from '../models/work-settings.model.js';
import type { MediaUploader } from './media-upload.service.js';
import { resolverZona } from './task-template-admin.service.js';

export interface TaskServiceDeps {
  db: Pool;
  reloj: Reloj;
  media: MediaUploader;
}

export type TaskService = ReturnType<typeof createTaskService>;

const noExiste = () => new NotFoundError('Esta tarea no existe.');
const enCampo = (field: string, message: string) => new ValidationError([{ field, message }]);

/** CU-57 2a-2b: cada motivo de bloqueo con su error. */
function lanzarSiBloqueada(motivo: TaskBlockReason | null): void {
  if (motivo === 'NOT_PENDING') throw new TaskNotPendingError();
  if (motivo === 'FUTURE_DAY') throw new TaskFutureDayError();
  if (motivo === 'MISSING_QUALIFICATION') throw new MissingQualificationError();
}

// CU-55 a CU-57 y CU-73: tareas del día, «Mi día» y ajustes.
export function createTaskService({ db, reloj, media }: TaskServiceDeps) {
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

  /** Completa o marca como no realizada (CU-57). La foto se guarda antes y se borra si algo falla. */
  async function resolver(
    user: SessionUser,
    id: number,
    datos: { status: 'completed' | 'not_done'; observations: string | null; archivo?: ArchivoSubido },
  ): Promise<TaskDto> {
    const cualificaciones = await qualificationModel.idsOfUser(db, user.id);
    lanzarSiBloqueada(bloqueo(await buscar(db, id), cualificaciones));
    let photoUrl: string | null = null;
    if (datos.archivo) {
      const guardada = await media.guardarImagen(`tasks/${id}`, datos.archivo);
      if ('code' in guardada) throw enCampo('files', guardada.message);
      photoUrl = guardada.url;
    }
    try {
      await withTransaction(db, async (client) => {
        lanzarSiBloqueada(bloqueo(await buscar(client, id, true), cualificaciones));
        await taskModel.resolve(client, id, {
          status: datos.status,
          resolvedBy: user.id,
          resolvedAt: reloj.ahora(),
          observations: datos.observations,
          photoUrl,
        });
      });
    } catch (error) {
      if (photoUrl) await media.borrar([photoUrl]);
      throw error;
    }
    return buscar(db, id);
  }

  return {
    /** CU-56: las tareas del día con lo que puede hacer quien las mira. */
    async myDay(user: SessionUser, fecha?: string): Promise<MyDayDto> {
      const date = fecha ?? reloj.hoy();
      const [tareas, cualificaciones] = await Promise.all([
        taskModel.listByDay(db, { date }, await contexto()),
        qualificationModel.idsOfUser(db, user.id),
      ]);
      const tasks: MyDayTaskDto[] = tareas.map((tarea) => ({
        ...tarea,
        mine: tarea.assignedTo?.id === user.id,
        blockedReason: tarea.status === 'pending' ? bloqueo(tarea, cualificaciones) : null,
      }));
      return { date, tasks };
    },

    /** CU-55: listado del día para el administrador. */
    async list(query: AdminTasksQuery): Promise<{ data: TaskDto[] }> {
      const filtros = { date: query.date ?? reloj.hoy(), zoneId: query.zoneId, status: query.status };
      return { data: await taskModel.listByDay(db, filtros, await contexto()) };
    },

    get: (id: number) => buscar(db, id),

    complete(user: SessionUser, id: number, observations: string | null, archivo?: ArchivoSubido) {
      return resolver(user, id, { status: 'completed', observations, archivo });
    },

    /** A1: el motivo queda en las observaciones. */
    notDone(user: SessionUser, id: number, reason: string) {
      return resolver(user, id, { status: 'not_done', observations: reason });
    },

    /** A2: quien la resolvió, el mismo día; un administrador, siempre. */
    async reopen(user: SessionUser, id: number): Promise<TaskDto> {
      const foto = await withTransaction(db, async (client) => {
        const tarea = await buscar(client, id, true);
        if (tarea.status === 'pending') throw new TaskIsPendingError();
        const esSuya =
          tarea.resolvedBy?.id === user.id &&
          tarea.resolvedAt !== null &&
          fechaEnZonaSantuario(new Date(tarea.resolvedAt)) === reloj.hoy();
        if (user.role !== 'admin' && !esSuya) throw new ForbiddenError('Solo quien la resolvió puede deshacerlo.');
        return taskModel.reopen(client, id);
      });
      if (foto) await media.borrar([foto]);
      return buscar(db, id);
    },

    /** CU-55 pasos 1-2: tarea puntual (sin plantilla). */
    async createOneOff(datos: OneOffTaskData, autorId: number): Promise<TaskDto> {
      if (datos.dueDate < reloj.hoy()) throw enCampo('dueDate', 'No se pueden crear tareas de días pasados.');
      const zona = datos.zoneId === null && datos.animalIds.length === 0 ? null : await resolverZona(db, datos);
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
        }),
      );
      return buscar(db, id!);
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
        return tarea;
      });
    },

    /** CU-73. */
    settings: (): Promise<WorkSettingsDto> => settingsModel.get(db),
    updateSettings: (datos: WorkSettingsData, userId: number) => settingsModel.update(db, datos, userId),
  };
}
