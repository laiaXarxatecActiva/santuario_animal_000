import type { TaskTemplateData, TaskTemplateDto } from '@sanctuary/shared';
import type { Pool } from 'pg';
import type { Queryable } from '../db/pool.js';
import { withTransaction } from '../db/transaction.js';
import { estaArchivado } from '../dominio/animal.js';
import type { Reloj } from '../dominio/reloj.js';
import { zonaComun } from '../dominio/tareas.js';
import { NotFoundError, TemplateHasHistoryError, ValidationError } from '../errors/app-error.js';
import * as animalModel from '../models/animal-admin.model.js';
import * as qualificationModel from '../models/qualification.model.js';
import * as taskModel from '../models/task.model.js';
import * as templateModel from '../models/task-template.model.js';
import * as zoneModel from '../models/zone.model.js';
import { generarParaPlantilla } from './generacion-tareas.js';

export interface TaskTemplateAdminServiceDeps {
  db: Pool;
  reloj: Reloj;
}

export type TaskTemplateAdminService = ReturnType<typeof createTaskTemplateAdminService>;

const noExiste = () => new NotFoundError('Esta plantilla no existe.');
const enCampo = (field: string, message: string) => new ValidationError([{ field, message }]);

/**
 * Comprueba la zona, la cualificación y los animales (CU-54 2a) y devuelve la
 * zona de la plantilla: la elegida o, si no hay, la de sus animales.
 */
export async function resolverZona(
  q: Queryable,
  datos: { zoneId: number | null; qualificationId: number | null; animalIds: readonly number[] },
): Promise<number | null> {
  if (datos.zoneId !== null) {
    const activa = await zoneModel.isActive(q, datos.zoneId);
    if (activa === null) throw enCampo('zoneId', 'Esta zona no existe.');
    if (!activa) throw enCampo('zoneId', 'Esta zona está desactivada.');
  }
  if (datos.qualificationId !== null && !(await qualificationModel.findById(q, datos.qualificationId))) {
    throw enCampo('qualificationId', 'Esta cualificación no existe.');
  }
  const animales = await animalModel.findForTasks(q, datos.animalIds);
  if (animales.length !== datos.animalIds.length) throw enCampo('animalIds', 'Este animal no existe.');
  const archivado = animales.find((a) => estaArchivado(a.status));
  if (archivado) throw enCampo('animalIds', `${archivado.name} ya no está en el santuario.`);
  if (datos.zoneId !== null) return datos.zoneId;
  const zona = zonaComun(animales);
  if (zona === null) {
    throw enCampo('animalIds', 'Estos animales no viven en la misma zona: elige una zona para la tarea.');
  }
  return zona;
}

// CU-54 Gestionar plantillas de tareas (solo administradores).
export function createTaskTemplateAdminService({ db, reloj }: TaskTemplateAdminServiceDeps) {
  async function buscar(q: Queryable, id: number): Promise<TaskTemplateDto> {
    const plantilla = await templateModel.findById(q, id);
    if (!plantilla) throw noExiste();
    return plantilla;
  }

  return {
    async list(): Promise<{ data: TaskTemplateDto[] }> {
      return { data: await templateModel.list(db) };
    },

    get: (id: number) => buscar(db, id),

    /** Pasos 2-3: se guarda y se generan sus tareas desde ahora. */
    async create(datos: TaskTemplateData, autorId: number): Promise<TaskTemplateDto> {
      return withTransaction(db, async (client) => {
        const zona = await resolverZona(client, datos);
        const id = await templateModel.create(client, datos, zona, autorId);
        if (datos.isActive) await generarParaPlantilla(client, id, reloj.hoy(), reloj.ahora());
        return buscar(client, id);
      });
    },

    /**
     * Paso 4 y A1: los cambios solo afectan a las tareas futuras sin resolver;
     * esas se rehacen. Desactivarla las borra y no genera más.
     */
    async update(id: number, datos: TaskTemplateData): Promise<TaskTemplateDto> {
      return withTransaction(db, async (client) => {
        if (!(await templateModel.lock(client, id))) throw noExiste();
        const zona = await resolverZona(client, datos);
        await templateModel.update(client, id, datos, zona);
        await taskModel.deletePendingOfTemplate(client, id, reloj.ahora());
        if (datos.isActive) await generarParaPlantilla(client, id, reloj.hoy(), reloj.ahora());
        return buscar(client, id);
      });
    },

    /** A2: con historial no se borra; sin él, se borra con sus tareas pendientes. */
    async remove(id: number): Promise<TaskTemplateDto> {
      return withTransaction(db, async (client) => {
        if (!(await templateModel.lock(client, id))) throw noExiste();
        const plantilla = await buscar(client, id);
        if (plantilla.hasHistory) throw new TemplateHasHistoryError();
        await templateModel.remove(client, id);
        return plantilla;
      });
    },
  };
}
