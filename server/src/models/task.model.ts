import type { IntakeLevel, NamedRef, TaskDto, TaskStatus, TaskType } from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';
import { animalesDeLaComida } from '../dominio/cuidados.js';
import { estaAtrasada } from '../dominio/tareas.js';
import { IncidentHasTaskError } from '../errors/app-error.js';

// CU-55 a CU-59: tareas concretas de cada día.

interface TaskRow {
  id: number;
  template_id: number | null;
  type: TaskType;
  title: string;
  description: string | null;
  zone_id: number | null;
  zone_name: string | null;
  qualification_id: number | null;
  qualification_name: string | null;
  due_date: string;
  due_time: string;
  due_at: Date;
  status: TaskStatus;
  assigned_to: number | null;
  assigned_name: string | null;
  resolved_by: number | null;
  resolved_name: string | null;
  resolved_at: Date | null;
  observations: string | null;
  medication_plan_id: number | null;
  vet_visit_id: number | null;
  incident_id: number | null;
  animals: NamedRef[];
  /** Solo en las de alimentación: los animales que viven ahora en su zona. */
  zone_animals: NamedRef[];
  intakes: { animal: NamedRef; intake: IntakeLevel }[];
}

/** Lo que hace falta para saber si una tarea está atrasada (CU-56). */
export interface Contexto {
  ahora: Date;
  margenMinutos: number;
}

const ref = (id: number | null, name: string | null): NamedRef | null =>
  id === null ? null : { id, name: name ?? '' };

export function mapRow(row: TaskRow, contexto: Contexto): TaskDto {
  return {
    id: row.id,
    templateId: row.template_id,
    type: row.type,
    title: row.title,
    description: row.description,
    zone: ref(row.zone_id, row.zone_name),
    animals: row.animals,
    qualification: ref(row.qualification_id, row.qualification_name),
    dueDate: row.due_date,
    dueTime: row.due_time,
    dueAt: row.due_at.toISOString(),
    status: row.status,
    late: estaAtrasada({ status: row.status, dueAt: row.due_at }, contexto.ahora, contexto.margenMinutos),
    assignedTo: ref(row.assigned_to, row.assigned_name),
    resolvedBy: ref(row.resolved_by, row.resolved_name),
    resolvedAt: row.resolved_at?.toISOString() ?? null,
    observations: row.observations,
    isOneOff: row.template_id === null && row.medication_plan_id === null && row.vet_visit_id === null,
    medicationPlanId: row.medication_plan_id,
    vetVisitId: row.vet_visit_id,
    incidentId: row.incident_id,
    feedingAnimals: row.type === 'feeding' ? animalesDeLaComida(row.animals, row.zone_animals) : [],
    intakes: row.intakes,
  };
}

const SELECT = `
  SELECT i.id, i.template_id, i.type, i.title, i.description, i.zone_id, z.name AS zone_name,
         i.qualification_id, q.name AS qualification_name, i.due_date, to_char(i.due_time, 'HH24:MI') AS due_time,
         i.due_at, i.status, i.assigned_to, ua.first_name || ' ' || ua.last_name AS assigned_name,
         i.resolved_by, ur.first_name || ' ' || ur.last_name AS resolved_name, i.resolved_at,
         i.observations, i.medication_plan_id, i.vet_visit_id, i.incident_id,
         COALESCE((SELECT json_agg(json_build_object('id', a.id, 'name', a.name) ORDER BY a.name, a.id)
                     FROM task_instance_animals ta JOIN animals a ON a.id = ta.animal_id
                    WHERE ta.task_id = i.id), '[]'::json) AS animals,
         CASE WHEN i.type = 'feeding' THEN
           COALESCE((SELECT json_agg(json_build_object('id', a.id, 'name', a.name) ORDER BY a.name, a.id)
                       FROM animals a
                      WHERE a.zone_id = i.zone_id AND a.status IN ('in_sanctuary', 'in_treatment')), '[]'::json)
         ELSE '[]'::json END AS zone_animals,
         COALESCE((SELECT json_agg(json_build_object('animal', json_build_object('id', a.id, 'name', a.name),
                                                     'intake', f.intake) ORDER BY a.name, a.id)
                     FROM feeding_logs f JOIN animals a ON a.id = f.animal_id
                    WHERE f.task_id = i.id), '[]'::json) AS intakes
    FROM task_instances i
    LEFT JOIN zones z ON z.id = i.zone_id
    LEFT JOIN qualifications q ON q.id = i.qualification_id
    LEFT JOIN users ua ON ua.id = i.assigned_to
    LEFT JOIN users ur ON ur.id = i.resolved_by`;

export interface TaskFilters {
  date: string;
  zoneId?: number;
  status?: TaskStatus;
}

/** Tareas de un día, por hora. */
export async function listByDay(db: Queryable, filtros: TaskFilters, contexto: Contexto): Promise<TaskDto[]> {
  const { rows } = await db.query<TaskRow>(
    `${SELECT}
      WHERE i.due_date = $1 AND ($2::int IS NULL OR i.zone_id = $2) AND ($3::text IS NULL OR i.status = $3)
      ORDER BY i.due_at, z.name NULLS LAST, i.title, i.id`,
    [filtros.date, filtros.zoneId ?? null, filtros.status ?? null],
  );
  return rows.map((r) => mapRow(r, contexto));
}

/** CU-55: las últimas creadas, de cualquier día (para encontrar una creada por error). */
export async function listRecent(
  db: Queryable,
  filtros: Omit<TaskFilters, 'date'> & { limit: number },
  contexto: Contexto,
): Promise<TaskDto[]> {
  const { rows } = await db.query<TaskRow>(
    `${SELECT}
      WHERE ($1::int IS NULL OR i.zone_id = $1) AND ($2::text IS NULL OR i.status = $2)
      ORDER BY i.created_at DESC, i.id DESC
      LIMIT $3`,
    [filtros.zoneId ?? null, filtros.status ?? null, filtros.limit],
  );
  return rows.map((r) => mapRow(r, contexto));
}

export async function findById(
  db: Queryable,
  id: number,
  contexto: Contexto,
  opciones: { forUpdate?: boolean } = {},
): Promise<TaskDto | null> {
  if (opciones.forUpdate) await db.query('SELECT 1 FROM task_instances WHERE id = $1 FOR UPDATE', [id]);
  const { rows } = await db.query<TaskRow>(`${SELECT} WHERE i.id = $1`, [id]);
  return rows[0] ? mapRow(rows[0], contexto) : null;
}

/** CU-57: completada o no realizada. */
export async function resolve(
  db: Queryable,
  id: number,
  datos: {
    status: Exclude<TaskStatus, 'pending'>;
    resolvedBy: number | null;
    resolvedAt: Date;
    observations: string | null;
  },
): Promise<void> {
  await db.query(
    `UPDATE task_instances
        SET status = $2, resolved_by = $3, resolved_at = $4, observations = $5
      WHERE id = $1`,
    [id, datos.status, datos.resolvedBy, datos.resolvedAt, datos.observations],
  );
}

/**
 * CU-57 A2: vuelve a pendiente (sin lo anotado de la comida, CU-66). Si es de una
 * incidencia que ya tiene otra tarea pendiente, 409 (índice
 * `task_instances_incident_pending_key`).
 */
export async function reopen(db: Queryable, id: number): Promise<void> {
  await db.query('DELETE FROM feeding_logs WHERE task_id = $1', [id]);
  try {
    await db.query(
      `UPDATE task_instances
          SET status = 'pending', resolved_by = NULL, resolved_at = NULL, observations = NULL
        WHERE id = $1`,
      [id],
    );
  } catch (error) {
    if (esDuplicado(error)) throw new IncidentHasTaskError();
    throw error;
  }
}

const esDuplicado = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';

/** CU-70: la tarea pendiente de una incidencia, si la tiene. */
export async function findPendingOfIncident(db: Queryable, incidentId: number): Promise<number | null> {
  const { rows } = await db.query<{ id: number }>(
    "SELECT id FROM task_instances WHERE incident_id = $1 AND status = 'pending' FOR UPDATE",
    [incidentId],
  );
  return rows[0]?.id ?? null;
}

export async function setAssignee(db: Queryable, id: number, userId: number | null): Promise<void> {
  await db.query('UPDATE task_instances SET assigned_to = $2 WHERE id = $1', [id, userId]);
}

export async function remove(db: Queryable, id: number): Promise<void> {
  await db.query('DELETE FROM task_instances WHERE id = $1', [id]);
}

export interface NuevaTarea {
  templateId: number | null;
  type: TaskType;
  title: string;
  description: string | null;
  zoneId: number | null;
  qualificationId: number | null;
  dueDate: string;
  dueTime: string;
  dueAt: Date;
  assignedTo: number | null;
  createdBy: number | null;
  animalIds: readonly number[];
  /** CU-69: dosis de una pauta. */
  medicationPlanId?: number | null;
  /** CU-68: tarea de una visita programada. */
  vetVisitId?: number | null;
  /** CU-70: tarea de una incidencia. */
  incidentId?: number | null;
}

/**
 * Inserta una tarea y sus animales. Las generadas no se duplican (índices
 * `task_instances_template_due_key` y `task_instances_medication_due_key`):
 * si ya existía, devuelve `null`.
 */
export async function insert(db: Queryable, t: NuevaTarea): Promise<number | null> {
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO task_instances (template_id, type, title, description, zone_id, qualification_id,
                                 due_date, due_time, due_at, assigned_to, created_by, medication_plan_id, vet_visit_id,
                                 incident_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [
      t.templateId,
      t.type,
      t.title,
      t.description,
      t.zoneId,
      t.qualificationId,
      t.dueDate,
      t.dueTime,
      t.dueAt,
      t.assignedTo,
      t.createdBy,
      t.medicationPlanId ?? null,
      t.vetVisitId ?? null,
      t.incidentId ?? null,
    ],
  );
  const id = rows[0]?.id ?? null;
  if (id !== null && t.animalIds.length > 0) {
    await db.query('INSERT INTO task_instance_animals (task_id, animal_id) SELECT $1, x FROM unnest($2::int[]) AS x', [
      id,
      t.animalIds,
    ]);
  }
  return id;
}

/** CU-54 A1: al editar o desactivar una plantilla, sus tareas pendientes desde ahora desaparecen. */
export async function deletePendingOfTemplate(db: Queryable, templateId: number, desde: Date): Promise<number> {
  const { rowCount } = await db.query(
    "DELETE FROM task_instances WHERE template_id = $1 AND status = 'pending' AND due_at >= $2",
    [templateId, desde],
  );
  return rowCount ?? 0;
}

/**
 * CU-58 4: un animal que deja el santuario sale de sus tareas pendientes desde
 * ahora; las que solo eran suyas desaparecen. Las resueltas no se tocan.
 */
export async function withdrawAnimal(db: Queryable, animalId: number, desde: Date): Promise<void> {
  const { rows } = await db.query<{ task_id: number }>(
    `DELETE FROM task_instance_animals ta USING task_instances i
      WHERE ta.task_id = i.id AND ta.animal_id = $1 AND i.status = 'pending' AND i.due_at >= $2
      RETURNING ta.task_id`,
    [animalId, desde],
  );
  if (rows.length === 0) return;
  await db.query(
    `DELETE FROM task_instances i
      WHERE i.id = ANY($1::int[]) AND NOT EXISTS (SELECT 1 FROM task_instance_animals x WHERE x.task_id = i.id)`,
    [rows.map((r) => r.task_id)],
  );
}

/**
 * CU-59: lo que sigue pendiente de días anteriores pasa a «no realizada» por el
 * sistema. Devuelve las cerradas, para que sus incidencias las sigan (CU-70).
 */
export async function closePastPending(
  db: Queryable,
  hoy: string,
  ahora: Date,
): Promise<{ id: number; incidentId: number | null; title: string }[]> {
  const { rows } = await db.query<{ id: number; incident_id: number | null; title: string }>(
    `UPDATE task_instances SET status = 'not_done', resolved_by = NULL, resolved_at = $2
      WHERE status = 'pending' AND due_date < $1
      RETURNING id, incident_id, title`,
    [hoy, ahora],
  );
  return rows.map((r) => ({ id: r.id, incidentId: r.incident_id, title: r.title }));
}

/** CU-69: al editar o terminar una pauta, sus dosis pendientes desde ahora desaparecen. */
export async function deletePendingOfPlan(db: Queryable, planId: number, desde: Date): Promise<number> {
  const { rowCount } = await db.query(
    "DELETE FROM task_instances WHERE medication_plan_id = $1 AND status = 'pending' AND due_at >= $2",
    [planId, desde],
  );
  return rowCount ?? 0;
}

/** CU-68: al cambiar o cancelar una visita, su tarea pendiente desaparece. */
export async function deletePendingOfVisit(db: Queryable, visitId: number): Promise<void> {
  await db.query("DELETE FROM task_instances WHERE vet_visit_id = $1 AND status = 'pending'", [visitId]);
}

/** CU-69: ¿tiene la pauta dosis ya resueltas? */
export async function planHasHistory(db: Queryable, planId: number): Promise<boolean> {
  const { rows } = await db.query(
    "SELECT 1 FROM task_instances WHERE medication_plan_id = $1 AND status <> 'pending' LIMIT 1",
    [planId],
  );
  return rows.length > 0;
}

/** Una dosis que puede tocar avisar (CU-69). */
export interface DosisParaAvisar {
  id: number;
  title: string;
  dueTime: string;
  dueDate: string;
  zoneId: number | null;
  animal: NamedRef | null;
}

/**
 * CU-69: dosis de medicación de esos días no dadas: marcadas como no
 * realizadas o pendientes pasada su hora y el margen (`limite`).
 */
export async function listMissedDoses(
  db: Queryable,
  filtros: { desde: string; hasta: string; limite: Date },
): Promise<DosisParaAvisar[]> {
  const { rows } = await db.query<{
    id: number;
    title: string;
    due_time: string;
    due_date: string;
    zone_id: number | null;
    animal_id: number | null;
    animal_name: string | null;
  }>(
    `SELECT i.id, i.title, to_char(i.due_time, 'HH24:MI') AS due_time, i.due_date::text AS due_date, i.zone_id,
            a.id AS animal_id, a.name AS animal_name
       FROM task_instances i
       LEFT JOIN LATERAL (SELECT an.id, an.name FROM task_instance_animals ta JOIN animals an ON an.id = ta.animal_id
                           WHERE ta.task_id = i.id ORDER BY an.name, an.id LIMIT 1) a ON TRUE
      WHERE i.medication_plan_id IS NOT NULL AND i.due_date BETWEEN $1 AND $2
        AND (i.status = 'not_done' OR (i.status = 'pending' AND i.due_at < $3))
      ORDER BY i.due_at, i.id`,
    [filtros.desde, filtros.hasta, filtros.limite],
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    dueTime: r.due_time,
    dueDate: r.due_date,
    zoneId: r.zone_id,
    animal: r.animal_id === null ? null : { id: r.animal_id, name: r.animal_name ?? '' },
  }));
}
