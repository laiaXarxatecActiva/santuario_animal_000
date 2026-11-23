import type { AbsenceData, AbsenceDto, AbsenceType } from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';

// CU-62: ausencias del personal.

interface AbsenceRow {
  id: number;
  user_id: number;
  user_name: string;
  start_date: string;
  end_date: string;
  type: AbsenceType;
  notes: string | null;
}

function mapRow(row: AbsenceRow): AbsenceDto {
  return {
    id: row.id,
    user: { id: row.user_id, name: row.user_name },
    startDate: row.start_date,
    endDate: row.end_date,
    type: row.type,
    notes: row.notes,
  };
}

const SELECT = `
  SELECT b.id, b.user_id, u.first_name || ' ' || u.last_name AS user_name,
         to_char(b.start_date, 'YYYY-MM-DD') AS start_date, to_char(b.end_date, 'YYYY-MM-DD') AS end_date,
         b.type, b.notes
    FROM absences b JOIN users u ON u.id = b.user_id`;

/** Las que tocan algún día del rango; sin `to`, todas desde `from`. */
export async function list(db: Queryable, filtros: { from: string; to: string | null }): Promise<AbsenceDto[]> {
  const { rows } = await db.query<AbsenceRow>(
    `${SELECT} WHERE b.end_date >= $1 AND ($2::date IS NULL OR b.start_date <= $2)
      ORDER BY b.start_date, u.first_name, u.last_name, b.id`,
    [filtros.from, filtros.to],
  );
  return rows.map(mapRow);
}

export async function findById(db: Queryable, id: number): Promise<AbsenceDto | null> {
  const { rows } = await db.query<AbsenceRow>(`${SELECT} WHERE b.id = $1`, [id]);
  return rows[0] ? mapRow(rows[0]) : null;
}

/** ¿Tiene ya alguna ausencia que toque esos días? */
export async function overlaps(db: Queryable, userId: number, desde: string, hasta: string): Promise<boolean> {
  const { rowCount } = await db.query(
    'SELECT 1 FROM absences WHERE user_id = $1 AND start_date <= $3 AND end_date >= $2 LIMIT 1',
    [userId, desde, hasta],
  );
  return (rowCount ?? 0) > 0;
}

export async function create(db: Queryable, datos: AbsenceData, createdBy: number): Promise<number> {
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO absences (user_id, start_date, end_date, type, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [datos.userId, datos.startDate, datos.endDate, datos.type, datos.notes ?? null, createdBy],
  );
  return rows[0]!.id;
}

export async function remove(db: Queryable, id: number): Promise<boolean> {
  const { rowCount } = await db.query('DELETE FROM absences WHERE id = $1', [id]);
  return (rowCount ?? 0) > 0;
}
