import type {
  AnimalStatus,
  NamedRef,
  TaskRecurrence,
  TaskTemplateData,
  TaskTemplateDto,
  TaskType,
} from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';

// CU-54: plantillas de tareas recurrentes.

interface TemplateRow {
  id: number;
  type: TaskType;
  title: string;
  description: string | null;
  zone_id: number | null;
  zone_name: string | null;
  qualification_id: number | null;
  qualification_name: string | null;
  times: string[];
  recurrence: TaskRecurrence;
  weekdays: number[] | null;
  interval_days: number | null;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  has_history: boolean;
  animals: NamedRef[];
}

const ref = (id: number | null, name: string | null): NamedRef | null =>
  id === null ? null : { id, name: name ?? '' };

function mapRow(row: TemplateRow): TaskTemplateDto {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    zone: ref(row.zone_id, row.zone_name),
    animals: row.animals,
    qualification: ref(row.qualification_id, row.qualification_name),
    times: row.times,
    recurrence: row.recurrence,
    weekdays: row.weekdays,
    intervalDays: row.interval_days,
    startDate: row.start_date,
    endDate: row.end_date,
    isActive: row.is_active,
    hasHistory: row.has_history,
  };
}

/** Horas `HH:MM` ordenadas de una columna TIME[]. */
export const HORAS_SQL = (columna: string) =>
  `ARRAY(SELECT to_char(h, 'HH24:MI') FROM unnest(${columna}) AS h ORDER BY h)`;

const SELECT = `
  SELECT t.id, t.type, t.title, t.description, t.zone_id, z.name AS zone_name,
         t.qualification_id, q.name AS qualification_name, ${HORAS_SQL('t.times')} AS times,
         t.recurrence, t.weekdays::int[] AS weekdays, t.interval_days, t.start_date, t.end_date, t.is_active,
         EXISTS (SELECT 1 FROM task_instances i WHERE i.template_id = t.id AND i.status <> 'pending') AS has_history,
         COALESCE((SELECT json_agg(json_build_object('id', a.id, 'name', a.name) ORDER BY a.name, a.id)
                     FROM task_template_animals ta JOIN animals a ON a.id = ta.animal_id
                    WHERE ta.template_id = t.id), '[]'::json) AS animals
    FROM task_templates t
    LEFT JOIN zones z ON z.id = t.zone_id
    LEFT JOIN qualifications q ON q.id = t.qualification_id`;

export async function list(db: Queryable): Promise<TaskTemplateDto[]> {
  const { rows } = await db.query<TemplateRow>(`${SELECT} ORDER BY t.is_active DESC, t.title, t.id`);
  return rows.map(mapRow);
}

export async function findById(db: Queryable, id: number): Promise<TaskTemplateDto | null> {
  const { rows } = await db.query<TemplateRow>(`${SELECT} WHERE t.id = $1`, [id]);
  return rows[0] ? mapRow(rows[0]) : null;
}

const valores = (d: TaskTemplateData, zoneId: number | null) => [
  d.type,
  d.title,
  d.description ?? null,
  zoneId,
  d.qualificationId,
  d.times,
  d.recurrence,
  d.weekdays,
  d.intervalDays,
  d.startDate,
  d.endDate,
  d.isActive,
];

/** `zoneId` es la zona ya resuelta (la elegida o la de sus animales). */
export async function create(
  db: Queryable,
  datos: TaskTemplateData,
  zoneId: number | null,
  createdBy: number,
): Promise<number> {
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO task_templates (type, title, description, zone_id, qualification_id, times, recurrence,
                                 weekdays, interval_days, start_date, end_date, is_active, created_by)
     VALUES ($1, $2, $3, $4, $5, $6::time[], $7, $8::smallint[], $9, $10, $11, $12, $13) RETURNING id`,
    [...valores(datos, zoneId), createdBy],
  );
  const id = rows[0]!.id;
  await setAnimals(db, id, datos.animalIds);
  return id;
}

/** `false` si no existe. */
export async function update(
  db: Queryable,
  id: number,
  datos: TaskTemplateData,
  zoneId: number | null,
): Promise<boolean> {
  const { rowCount } = await db.query(
    `UPDATE task_templates
        SET type = $2, title = $3, description = $4, zone_id = $5, qualification_id = $6, times = $7::time[],
            recurrence = $8, weekdays = $9::smallint[], interval_days = $10, start_date = $11, end_date = $12,
            is_active = $13
      WHERE id = $1`,
    [id, ...valores(datos, zoneId)],
  );
  if ((rowCount ?? 0) === 0) return false;
  await setAnimals(db, id, datos.animalIds);
  return true;
}

async function setAnimals(db: Queryable, id: number, animalIds: readonly number[]): Promise<void> {
  await db.query('DELETE FROM task_template_animals WHERE template_id = $1', [id]);
  await db.query(
    'INSERT INTO task_template_animals (template_id, animal_id) SELECT $1, x FROM unnest($2::int[]) AS x',
    [id, animalIds],
  );
}

/** Borra la plantilla y sus tareas (solo se llama si no tiene historial). */
export async function remove(db: Queryable, id: number): Promise<boolean> {
  const { rowCount } = await db.query('DELETE FROM task_templates WHERE id = $1', [id]);
  return (rowCount ?? 0) > 0;
}

/** Bloquea la plantilla mientras se edita o se generan sus tareas. */
export async function lock(db: Queryable, id: number): Promise<boolean> {
  const { rowCount } = await db.query('SELECT 1 FROM task_templates WHERE id = $1 FOR UPDATE', [id]);
  return rowCount === 1;
}

/** Lo que necesita la generación de tareas (CU-58). */
export interface PlantillaParaGenerar {
  id: number;
  type: TaskType;
  title: string;
  description: string | null;
  zoneId: number | null;
  qualificationId: number | null;
  times: string[];
  recurrence: TaskRecurrence;
  weekdays: number[] | null;
  intervalDays: number | null;
  startDate: string;
  endDate: string | null;
  animals: { id: number; status: AnimalStatus; zoneId: number | null }[];
}

interface GenerarRow {
  id: number;
  type: TaskType;
  title: string;
  description: string | null;
  zone_id: number | null;
  qualification_id: number | null;
  times: string[];
  recurrence: TaskRecurrence;
  weekdays: number[] | null;
  interval_days: number | null;
  start_date: string;
  end_date: string | null;
  animals: { id: number; status: AnimalStatus; zoneId: number | null }[];
}

/** Plantillas activas que pueden tener tareas entre dos fechas (o solo una, si se indica). */
export async function listForGeneration(
  db: Queryable,
  rango: { desde: string; hasta: string; id?: number },
): Promise<PlantillaParaGenerar[]> {
  const { rows } = await db.query<GenerarRow>(
    `SELECT t.id, t.type, t.title, t.description, t.zone_id, t.qualification_id, ${HORAS_SQL('t.times')} AS times,
            t.recurrence, t.weekdays::int[] AS weekdays, t.interval_days, t.start_date, t.end_date,
            COALESCE((SELECT json_agg(json_build_object('id', a.id, 'status', a.status, 'zoneId', a.zone_id) ORDER BY a.id)
                        FROM task_template_animals ta JOIN animals a ON a.id = ta.animal_id
                       WHERE ta.template_id = t.id), '[]'::json) AS animals
       FROM task_templates t
      WHERE t.is_active AND t.start_date <= $2 AND (t.end_date IS NULL OR t.end_date >= $1)
        AND ($3::int IS NULL OR t.id = $3)
      ORDER BY t.id`,
    [rango.desde, rango.hasta, rango.id ?? null],
  );
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    description: r.description,
    zoneId: r.zone_id,
    qualificationId: r.qualification_id,
    times: r.times,
    recurrence: r.recurrence,
    weekdays: r.weekdays,
    intervalDays: r.interval_days,
    startDate: r.start_date,
    endDate: r.end_date,
    animals: r.animals,
  }));
}
