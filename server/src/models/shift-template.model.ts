import type { ShiftTemplateData, ShiftTemplateDto } from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';
import { esErrorPg, PG_FOREIGN_KEY_VIOLATION, PG_RESTRICT_VIOLATION, PG_UNIQUE_VIOLATION } from '../db/pg-errors.js';
import { ShiftTemplateInUseError, ShiftTemplateNameTakenError } from '../errors/app-error.js';

// CU-60: plantillas de turno y lo que necesita cada zona.

interface ShiftTemplateRow {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  weekdays: number[];
  is_active: boolean;
  requirements: { zone: { id: number; name: string }; minWorkers: number }[];
  has_assignments: boolean;
}

export function mapRow(row: ShiftTemplateRow): ShiftTemplateDto {
  return {
    id: row.id,
    name: row.name,
    startTime: row.start_time,
    endTime: row.end_time,
    weekdays: row.weekdays,
    isActive: row.is_active,
    requirements: row.requirements,
    hasAssignments: row.has_assignments,
  };
}

const SELECT = `
  SELECT s.id, s.name, to_char(s.start_time, 'HH24:MI') AS start_time, to_char(s.end_time, 'HH24:MI') AS end_time,
         s.weekdays::int[] AS weekdays, s.is_active,
         COALESCE((SELECT json_agg(json_build_object('zone', json_build_object('id', z.id, 'name', z.name),
                                                     'minWorkers', r.min_workers) ORDER BY z.name, z.id)
                     FROM shift_zone_requirements r JOIN zones z ON z.id = r.zone_id
                    WHERE r.shift_template_id = s.id), '[]') AS requirements,
         EXISTS (SELECT 1 FROM shift_assignments a WHERE a.shift_template_id = s.id) AS has_assignments
    FROM shift_templates s`;

function traducirError(error: unknown): never {
  if (esErrorPg(error, PG_UNIQUE_VIOLATION)) throw new ShiftTemplateNameTakenError();
  if (esErrorPg(error, PG_FOREIGN_KEY_VIOLATION) || esErrorPg(error, PG_RESTRICT_VIOLATION)) {
    throw new ShiftTemplateInUseError();
  }
  throw error;
}

/** Ordenadas por la hora de inicio. Con `ids`, las activas y esas. */
export async function list(db: Queryable, opciones: { activasYEstas?: number[] } = {}): Promise<ShiftTemplateDto[]> {
  const filtro = opciones.activasYEstas ? 'WHERE s.is_active OR s.id = ANY($1::int[])' : '';
  const { rows } = await db.query<ShiftTemplateRow>(
    `${SELECT} ${filtro} ORDER BY s.start_time, s.name, s.id`,
    opciones.activasYEstas ? [opciones.activasYEstas] : [],
  );
  return rows.map(mapRow);
}

export async function findById(db: Queryable, id: number): Promise<ShiftTemplateDto | null> {
  const { rows } = await db.query<ShiftTemplateRow>(`${SELECT} WHERE s.id = $1`, [id]);
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function create(db: Queryable, datos: ShiftTemplateData): Promise<number> {
  const { rows } = await db
    .query<{ id: number }>(
      `INSERT INTO shift_templates (name, start_time, end_time, weekdays, is_active)
       VALUES ($1, $2, $3, $4::smallint[], $5) RETURNING id`,
      [datos.name, datos.startTime, datos.endTime, datos.weekdays, datos.isActive],
    )
    .catch(traducirError);
  return rows[0]!.id;
}

export async function update(db: Queryable, id: number, datos: ShiftTemplateData): Promise<boolean> {
  const { rowCount } = await db
    .query(
      `UPDATE shift_templates SET name = $2, start_time = $3, end_time = $4, weekdays = $5::smallint[], is_active = $6
        WHERE id = $1`,
      [id, datos.name, datos.startTime, datos.endTime, datos.weekdays, datos.isActive],
    )
    .catch(traducirError);
  return (rowCount ?? 0) > 0;
}

export async function setRequirements(
  db: Queryable,
  id: number,
  requisitos: readonly { zoneId: number; minWorkers: number }[],
): Promise<void> {
  await db.query('DELETE FROM shift_zone_requirements WHERE shift_template_id = $1', [id]);
  if (requisitos.length === 0) return;
  await db.query(
    `INSERT INTO shift_zone_requirements (shift_template_id, zone_id, min_workers)
     SELECT $1, z, m FROM unnest($2::int[], $3::smallint[]) AS r (z, m)`,
    [id, requisitos.map((r) => r.zoneId), requisitos.map((r) => r.minWorkers)],
  );
}

export async function remove(db: Queryable, id: number): Promise<boolean> {
  const { rowCount } = await db.query('DELETE FROM shift_templates WHERE id = $1', [id]).catch(traducirError);
  return (rowCount ?? 0) > 0;
}
