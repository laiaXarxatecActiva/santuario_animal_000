import type { NamedRef, TaskDto, TaskStatus, TaskType } from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';
import { estaAtrasada } from '../dominio/tareas.js';

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
  photo_url: string | null;
  animals: NamedRef[];
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
    photoUrl: row.photo_url,
    isOneOff: row.template_id === null,
  };
}

const SELECT = `
  SELECT i.id, i.template_id, i.type, i.title, i.description, i.zone_id, z.name AS zone_name,
         i.qualification_id, q.name AS qualification_name, i.due_date, to_char(i.due_time, 'HH24:MI') AS due_time,
         i.due_at, i.status, i.assigned_to, ua.first_name || ' ' || ua.last_name AS assigned_name,
         i.resolved_by, ur.first_name || ' ' || ur.last_name AS resolved_name, i.resolved_at,
         i.observations, i.photo_url,
         COALESCE((SELECT json_agg(json_build_object('id', a.id, 'name', a.name) ORDER BY a.name, a.id)
                     FROM task_instance_animals ta JOIN animals a ON a.id = ta.animal_id
                    WHERE ta.task_id = i.id), '[]'::json) AS animals
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
    photoUrl: string | null;
  },
): Promise<void> {
  await db.query(
    `UPDATE task_instances
        SET status = $2, resolved_by = $3, resolved_at = $4, observations = $5, photo_url = $6
      WHERE id = $1`,
    [id, datos.status, datos.resolvedBy, datos.resolvedAt, datos.observations, datos.photoUrl],
  );
}

/** CU-57 A2: vuelve a pendiente. Devuelve la foto que tenía, para borrarla. */
export async function reopen(db: Queryable, id: number): Promise<string | null> {
  const { rows } = await db.query<{ photo_url: string | null }>(
    `UPDATE task_instances i
        SET status = 'pending', resolved_by = NULL, resolved_at = NULL, observations = NULL, photo_url = NULL
       FROM task_instances antes
      WHERE i.id = $1 AND antes.id = i.id
      RETURNING antes.photo_url`,
    [id],
  );
  return rows[0]?.photo_url ?? null;
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
}

/**
 * Inserta una tarea y sus animales. Las generadas no se duplican (índice
 * `task_instances_template_due_key`): si ya existía, devuelve `null`.
 */
export async function insert(db: Queryable, t: NuevaTarea): Promise<number | null> {
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO task_instances (template_id, type, title, description, zone_id, qualification_id,
                                 due_date, due_time, due_at, assigned_to, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (template_id, due_at) WHERE template_id IS NOT NULL DO NOTHING
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

/** CU-59: lo que sigue pendiente de días anteriores pasa a «no realizada» por el sistema. */
export async function closePastPending(db: Queryable, hoy: string, ahora: Date): Promise<number> {
  const { rowCount } = await db.query(
    "UPDATE task_instances SET status = 'not_done', resolved_by = NULL, resolved_at = $2 WHERE status = 'pending' AND due_date < $1",
    [hoy, ahora],
  );
  return rowCount ?? 0;
}
