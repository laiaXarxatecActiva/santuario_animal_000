import { TASK_GENERATION_DAYS } from '@sanctuary/shared';
import type { Pool } from 'pg';
import type { Queryable } from '../db/pool.js';
import { withTransaction } from '../db/transaction.js';
import { estaArchivado } from '../dominio/animal.js';
import { ocurrencias, sumarDias, zonaComun } from '../dominio/tareas.js';
import * as taskModel from '../models/task.model.js';
import * as templateModel from '../models/task-template.model.js';
import type { PlantillaParaGenerar } from '../models/task-template.model.js';

// CU-58: genera las tareas concretas a partir de las plantillas activas.

/** Días de la generación: de hoy a 6 días después (7 en total). */
export function rangoDeGeneracion(hoy: string): { desde: string; hasta: string } {
  return { desde: hoy, hasta: sumarDias(hoy, TASK_GENERATION_DAYS - 1) };
}

/**
 * Tareas de una plantilla entre dos fechas, desde `ahora`. Idempotente: las que
 * ya existen no se duplican. Los animales fallecidos o trasladados no cuentan;
 * si la plantilla era solo de ellos, no se genera nada.
 */
export async function generarDePlantilla(
  q: Queryable,
  plantilla: PlantillaParaGenerar,
  rango: { desde: string; hasta: string },
  ahora: Date,
): Promise<number> {
  const animales = plantilla.animals.filter((a) => !estaArchivado(a.status));
  if (plantilla.animals.length > 0 && animales.length === 0) return 0;
  const zoneId = plantilla.zoneId ?? zonaComun(animales);
  if (zoneId === null) return 0;
  let creadas = 0;
  for (const o of ocurrencias(plantilla, rango.desde, rango.hasta, ahora)) {
    const id = await taskModel.insert(q, {
      templateId: plantilla.id,
      type: plantilla.type,
      title: plantilla.title,
      description: plantilla.description,
      zoneId,
      qualificationId: plantilla.qualificationId,
      dueDate: o.fecha,
      dueTime: o.hora,
      dueAt: o.instante,
      assignedTo: null,
      createdBy: null,
      animalIds: animales.map((a) => a.id),
    });
    if (id !== null) creadas += 1;
  }
  return creadas;
}

/** Genera las tareas de una sola plantilla (al crearla o editarla), dentro de la transacción en curso. */
export async function generarParaPlantilla(
  q: Queryable,
  plantillaId: number,
  hoy: string,
  ahora: Date,
): Promise<number> {
  const rango = rangoDeGeneracion(hoy);
  const [plantilla] = await templateModel.listForGeneration(q, { ...rango, id: plantillaId });
  return plantilla ? generarDePlantilla(q, plantilla, rango, ahora) : 0;
}

/**
 * La tarea programada: todas las plantillas activas, cada una en su propia
 * transacción para que un fallo en una no impida generar las demás.
 */
export async function generarTodas(
  db: Pool,
  hoy: string,
  ahora: Date,
  logError: (error: unknown, contexto: string) => void = () => {},
): Promise<{ templates: number; created: number }> {
  const rango = rangoDeGeneracion(hoy);
  const plantillas = await templateModel.listForGeneration(db, rango);
  let created = 0;
  for (const plantilla of plantillas) {
    try {
      created += await withTransaction(db, async (client) => {
        await templateModel.lock(client, plantilla.id);
        return generarDePlantilla(client, plantilla, rango, ahora);
      });
    } catch (error) {
      logError(error, `No se han podido generar las tareas de la plantilla ${plantilla.id}`);
    }
  }
  return { templates: plantillas.length, created };
}
