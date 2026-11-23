import type { ShiftAssignmentDto } from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';

// CU-61 y CU-63: personas en los turnos, con sus zonas y su fichaje.

interface AssignmentRow {
  id: number;
  shift_template_id: number;
  shift_name: string;
  start_time: string;
  end_time: string;
  shift_date: string;
  user_id: number;
  user_name: string;
  zones: { id: number; name: string }[];
  checked_in_at: Date | null;
  checked_out_at: Date | null;
}

export function mapRow(row: AssignmentRow): ShiftAssignmentDto {
  return {
    id: row.id,
    shift: { id: row.shift_template_id, name: row.shift_name, startTime: row.start_time, endTime: row.end_time },
    date: row.shift_date,
    user: { id: row.user_id, name: row.user_name },
    zones: row.zones,
    checkedInAt: row.checked_in_at?.toISOString() ?? null,
    checkedOutAt: row.checked_out_at?.toISOString() ?? null,
  };
}

const SELECT = `
  SELECT a.id, a.shift_template_id, s.name AS shift_name,
         to_char(s.start_time, 'HH24:MI') AS start_time, to_char(s.end_time, 'HH24:MI') AS end_time,
         to_char(a.shift_date, 'YYYY-MM-DD') AS shift_date,
         a.user_id, u.first_name || ' ' || u.last_name AS user_name,
         COALESCE((SELECT json_agg(json_build_object('id', z.id, 'name', z.name) ORDER BY z.name, z.id)
                     FROM shift_assignment_zones az JOIN zones z ON z.id = az.zone_id
                    WHERE az.assignment_id = a.id), '[]') AS zones,
         a.checked_in_at, a.checked_out_at
    FROM shift_assignments a
    JOIN shift_templates s ON s.id = a.shift_template_id
    JOIN users u ON u.id = a.user_id`;

const ORDEN = 'ORDER BY a.shift_date, s.start_time, s.name, u.first_name, u.last_name, a.id';

/** De un rango de días; con `userId`, solo los de esa persona. */
export async function listByRange(
  db: Queryable,
  filtros: { from: string; to: string; userId?: number },
): Promise<ShiftAssignmentDto[]> {
  const { rows } = await db.query<AssignmentRow>(
    `${SELECT} WHERE a.shift_date BETWEEN $1 AND $2 AND ($3::int IS NULL OR a.user_id = $3) ${ORDEN}`,
    [filtros.from, filtros.to, filtros.userId ?? null],
  );
  return rows.map(mapRow);
}

export async function findById(db: Queryable, id: number): Promise<ShiftAssignmentDto | null> {
  const { rows } = await db.query<AssignmentRow>(`${SELECT} WHERE a.id = $1`, [id]);
  return rows[0] ? mapRow(rows[0]) : null;
}

/** Bloquea la fila hasta el final de la transacción. */
export async function lock(db: Queryable, id: number): Promise<boolean> {
  const { rowCount } = await db.query('SELECT 1 FROM shift_assignments WHERE id = $1 FOR UPDATE', [id]);
  return (rowCount ?? 0) > 0;
}

export async function create(
  db: Queryable,
  datos: { shiftId: number; date: string; userId: number; zoneIds: readonly number[]; createdBy: number | null },
): Promise<number> {
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO shift_assignments (shift_template_id, shift_date, user_id, created_by)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [datos.shiftId, datos.date, datos.userId, datos.createdBy],
  );
  const id = rows[0]!.id;
  if (datos.zoneIds.length > 0) {
    await db.query('INSERT INTO shift_assignment_zones (assignment_id, zone_id) SELECT $1, unnest($2::int[])', [
      id,
      datos.zoneIds,
    ]);
  }
  return id;
}

export async function remove(db: Queryable, ids: readonly number[]): Promise<void> {
  if (ids.length === 0) return;
  await db.query('DELETE FROM shift_assignments WHERE id = ANY($1::int[])', [ids]);
}

export async function checkIn(db: Queryable, id: number, ahora: Date): Promise<void> {
  await db.query('UPDATE shift_assignments SET checked_in_at = $2 WHERE id = $1', [id, ahora]);
}

export async function checkOut(db: Queryable, id: number, ahora: Date): Promise<void> {
  await db.query('UPDATE shift_assignments SET checked_out_at = $2 WHERE id = $1', [id, ahora]);
}

/** Turnos de una persona desde una fecha (y hasta otra, si se indica). */
export async function listOfUser(
  db: Queryable,
  userId: number,
  desde: string,
  hasta: string | null,
): Promise<ShiftAssignmentDto[]> {
  const { rows } = await db.query<AssignmentRow>(
    `${SELECT} WHERE a.user_id = $1 AND a.shift_date >= $2 AND ($3::date IS NULL OR a.shift_date <= $3) ${ORDEN}`,
    [userId, desde, hasta],
  );
  return rows.map(mapRow);
}

/** CU-35: al desactivar a un trabajador, sus turnos de hoy en adelante que no ha fichado. */
export async function removeFutureOfUser(db: Queryable, userId: number, hoy: string): Promise<number> {
  const { rowCount } = await db.query(
    'DELETE FROM shift_assignments WHERE user_id = $1 AND shift_date >= $2 AND checked_in_at IS NULL',
    [userId, hoy],
  );
  return rowCount ?? 0;
}
