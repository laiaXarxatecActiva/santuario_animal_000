import { TASK_GENERATION_DAYS } from '@sanctuary/shared';
import type { Pool } from 'pg';
import type { Queryable } from '../db/pool.js';
import { withTransaction } from '../db/transaction.js';
import { estaArchivado } from '../dominio/animal.js';
import { ocurrenciasDeLaPauta, tituloDeLaDosis } from '../dominio/cuidados.js';
import { ocurrencias, sumarDias, zonaComun } from '../dominio/tareas.js';
import * as planModel from '../models/medication-plan.model.js';
import type { PautaParaGenerar } from '../models/medication-plan.model.js';
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

/**
 * CU-69: las dosis de una pauta entre dos fechas, desde `ahora`, en la zona
 * de su animal. Idempotente. Si el animal ya no está o no tiene zona, nada.
 */
export async function generarDePauta(
  q: Queryable,
  pauta: PautaParaGenerar,
  rango: { desde: string; hasta: string },
  ahora: Date,
): Promise<number> {
  if (estaArchivado(pauta.animal.status) || pauta.animal.zoneId === null) return 0;
  let creadas = 0;
  for (const o of ocurrenciasDeLaPauta(pauta, rango.desde, rango.hasta, ahora)) {
    const id = await taskModel.insert(q, {
      templateId: null,
      medicationPlanId: pauta.id,
      type: 'medication',
      title: tituloDeLaDosis(pauta.medication, pauta.dose),
      description: pauta.notes,
      zoneId: pauta.animal.zoneId,
      qualificationId: pauta.qualificationId,
      dueDate: o.fecha,
      dueTime: o.hora,
      dueAt: o.instante,
      assignedTo: null,
      createdBy: null,
      animalIds: [pauta.animal.id],
    });
    if (id !== null) creadas += 1;
  }
  return creadas;
}

/** Las dosis de una sola pauta (al crearla o editarla), dentro de la transacción en curso. */
export async function generarParaPauta(q: Queryable, pautaId: number, hoy: string, ahora: Date): Promise<number> {
  const rango = rangoDeGeneracion(hoy);
  const [pauta] = await planModel.listForGeneration(q, { ...rango, id: pautaId });
  return pauta ? generarDePauta(q, pauta, rango, ahora) : 0;
}

/** La tarea programada: todas las pautas con días en el rango, cada una en su transacción. */
export async function generarTodasLasPautas(
  db: Pool,
  hoy: string,
  ahora: Date,
  logError: (error: unknown, contexto: string) => void = () => {},
): Promise<number> {
  const rango = rangoDeGeneracion(hoy);
  let creadas = 0;
  for (const pauta of await planModel.listForGeneration(db, rango)) {
    try {
      creadas += await withTransaction(db, async (client) => {
        await planModel.lock(client, pauta.id);
        return generarDePauta(client, pauta, rango, ahora);
      });
    } catch (error) {
      logError(error, `No se han podido generar las dosis de la pauta ${pauta.id}`);
    }
  }
  return creadas;
}
