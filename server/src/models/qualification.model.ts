import type { NamedRef, QualificationData, QualificationDto } from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';
import { esErrorPg, PG_FOREIGN_KEY_VIOLATION, PG_RESTRICT_VIOLATION, PG_UNIQUE_VIOLATION } from '../db/pg-errors.js';
import { QualificationNameTakenError, QualificationInUseError } from '../errors/app-error.js';

// CU-53: cualificaciones y las de cada trabajador.

interface QualificationRow {
  id: number;
  name: string;
  description: string | null;
  worker_count: number;
}

function mapRow(row: QualificationRow): QualificationDto {
  return { id: row.id, name: row.name, description: row.description, workerCount: row.worker_count };
}

const SELECT = `
  SELECT q.id, q.name, q.description,
         (SELECT count(*)::int FROM user_qualifications uq WHERE uq.qualification_id = q.id) AS worker_count
    FROM qualifications q`;

function traducirError(error: unknown): never {
  if (esErrorPg(error, PG_UNIQUE_VIOLATION)) throw new QualificationNameTakenError();
  if (esErrorPg(error, PG_FOREIGN_KEY_VIOLATION) || esErrorPg(error, PG_RESTRICT_VIOLATION))
    throw new QualificationInUseError();
  throw error;
}

export async function list(db: Queryable): Promise<QualificationDto[]> {
  const { rows } = await db.query<QualificationRow>(`${SELECT} ORDER BY q.name, q.id`);
  return rows.map(mapRow);
}

export async function findById(db: Queryable, id: number): Promise<QualificationDto | null> {
  const { rows } = await db.query<QualificationRow>(`${SELECT} WHERE q.id = $1`, [id]);
  return rows[0] ? mapRow(rows[0]) : null;
}

/** Ids de la lista que no existen. */
export async function missing(db: Queryable, ids: readonly number[]): Promise<number[]> {
  if (ids.length === 0) return [];
  const { rows } = await db.query<{ id: number }>(
    'SELECT x.id FROM unnest($1::int[]) AS x(id) WHERE NOT EXISTS (SELECT 1 FROM qualifications q WHERE q.id = x.id)',
    [ids],
  );
  return rows.map((r) => r.id);
}

export async function create(db: Queryable, datos: QualificationData): Promise<number> {
  const { rows } = await db
    .query<{ id: number }>('INSERT INTO qualifications (name, description) VALUES ($1, $2) RETURNING id', [
      datos.name,
      datos.description ?? null,
    ])
    .catch(traducirError);
  return rows[0]!.id;
}

export async function update(db: Queryable, id: number, datos: QualificationData): Promise<boolean> {
  const { rowCount } = await db
    .query('UPDATE qualifications SET name = $2, description = $3 WHERE id = $1', [
      id,
      datos.name,
      datos.description ?? null,
    ])
    .catch(traducirError);
  return (rowCount ?? 0) > 0;
}

export async function remove(db: Queryable, id: number): Promise<boolean> {
  const { rowCount } = await db.query('DELETE FROM qualifications WHERE id = $1', [id]).catch(traducirError);
  return (rowCount ?? 0) > 0;
}

/** Cualificaciones de un usuario, por nombre. */
export async function listOfUser(db: Queryable, userId: number): Promise<NamedRef[]> {
  const { rows } = await db.query<NamedRef>(
    `SELECT q.id, q.name FROM user_qualifications uq JOIN qualifications q ON q.id = uq.qualification_id
      WHERE uq.user_id = $1 ORDER BY q.id`,
    [userId],
  );
  return rows;
}

/** Ids de las cualificaciones de un usuario (CU-57). */
export async function idsOfUser(db: Queryable, userId: number): Promise<number[]> {
  return (await listOfUser(db, userId)).map((q) => q.id);
}

/** ¿Tiene el usuario esta cualificación? */
export async function userHas(db: Queryable, userId: number, qualificationId: number): Promise<boolean> {
  const { rowCount } = await db.query(
    'SELECT 1 FROM user_qualifications WHERE user_id = $1 AND qualification_id = $2',
    [userId, qualificationId],
  );
  return rowCount === 1;
}

/** Sustituye las cualificaciones de un trabajador (CU-53 paso 3). */
export async function replaceOfUser(db: Queryable, userId: number, ids: readonly number[]): Promise<void> {
  await db.query('DELETE FROM user_qualifications WHERE user_id = $1 AND NOT (qualification_id = ANY($2::int[]))', [
    userId,
    ids,
  ]);
  await db.query(
    `INSERT INTO user_qualifications (user_id, qualification_id)
     SELECT $1, x FROM unnest($2::int[]) AS x ON CONFLICT DO NOTHING`,
    [userId, ids],
  );
}
