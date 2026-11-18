import type { VetRecordDto, VetRecordType } from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';
import { esErrorPg, PG_CHECK_VIOLATION, PG_FOREIGN_KEY_VIOLATION } from '../db/pg-errors.js';
import { NotFoundError, ValidationError } from '../errors/app-error.js';

export interface VetRecordData {
  recordDate: string;
  type: VetRecordType;
  description: string;
  weightKg: string | null;
  veterinarian: string | null;
}

interface VetRecordRow {
  id: number;
  animal_id: number;
  record_date: string;
  type: VetRecordType;
  description: string;
  weight_kg: string | null;
  veterinarian: string | null;
  created_by: number | null;
  created_by_name: string | null;
  created_at: Date;
  updated_at: Date;
}

function mapRow(row: VetRecordRow): VetRecordDto {
  return {
    id: row.id,
    animalId: row.animal_id,
    recordDate: row.record_date,
    type: row.type,
    description: row.description,
    weightKg: row.weight_kg,
    veterinarian: row.veterinarian,
    createdBy: row.created_by === null ? null : { id: row.created_by, name: row.created_by_name ?? '' },
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const SELECT = `
  SELECT v.id, v.animal_id, v.record_date::text AS record_date, v.type, v.description, v.weight_kg,
         v.veterinarian, v.created_by, u.first_name || ' ' || u.last_name AS created_by_name,
         v.created_at, v.updated_at
    FROM vet_records v
    LEFT JOIN users u ON u.id = v.created_by`;

/** Paso 2: del más reciente al más antiguo. */
export async function listByAnimal(db: Queryable, animalId: number): Promise<VetRecordDto[]> {
  const { rows } = await db.query<VetRecordRow>(
    `${SELECT} WHERE v.animal_id = $1 ORDER BY v.record_date DESC, v.id DESC`,
    [animalId],
  );
  return rows.map(mapRow);
}

export async function findById(db: Queryable, id: number): Promise<VetRecordDto | null> {
  const { rows } = await db.query<VetRecordRow>(`${SELECT} WHERE v.id = $1`, [id]);
  return rows[0] ? mapRow(rows[0]) : null;
}

/** El animal borrado entretanto da 404; un peso no válido que llegue a la BD, error en el campo. */
function traducirError(error: unknown): never {
  if (esErrorPg(error, PG_FOREIGN_KEY_VIOLATION)) throw new NotFoundError('Este animal no existe.');
  if (esErrorPg(error, PG_CHECK_VIOLATION)) {
    throw new ValidationError([{ field: 'weightKg', message: 'El peso debe ser mayor que 0.' }]);
  }
  throw error;
}

export async function create(
  db: Queryable,
  animalId: number,
  datos: VetRecordData,
  createdBy: number,
): Promise<number> {
  const { rows } = await db
    .query<{ id: number }>(
      `INSERT INTO vet_records (animal_id, record_date, type, description, weight_kg, veterinarian, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [animalId, datos.recordDate, datos.type, datos.description, datos.weightKg, datos.veterinarian, createdBy],
    )
    .catch(traducirError);
  return rows[0]!.id;
}

/** Devuelve `false` si el registro no existe. */
export async function update(db: Queryable, id: number, datos: VetRecordData): Promise<boolean> {
  const { rowCount } = await db
    .query(
      `UPDATE vet_records
          SET record_date = $2, type = $3, description = $4, weight_kg = $5, veterinarian = $6
        WHERE id = $1`,
      [id, datos.recordDate, datos.type, datos.description, datos.weightKg, datos.veterinarian],
    )
    .catch(traducirError);
  return (rowCount ?? 0) > 0;
}

/** Devuelve `false` si el registro no existe. */
export async function remove(db: Queryable, id: number): Promise<boolean> {
  const { rowCount } = await db.query('DELETE FROM vet_records WHERE id = $1', [id]);
  return (rowCount ?? 0) > 0;
}
