import type { ZoneData, ZoneDto } from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';
import { esErrorPg, PG_FOREIGN_KEY_VIOLATION, PG_RESTRICT_VIOLATION, PG_UNIQUE_VIOLATION } from '../db/pg-errors.js';
import { ZoneNameTakenError, ZoneInUseError } from '../errors/app-error.js';

// CU-52: zonas o recintos.

interface ZoneRow {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  animal_count: number;
}

function mapRow(row: ZoneRow): ZoneDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isActive: row.is_active,
    animalCount: row.animal_count,
  };
}

// Solo cuentan los animales que siguen en el santuario.
const SELECT = `
  SELECT z.id, z.name, z.description, z.is_active,
         (SELECT count(*)::int FROM animals a
           WHERE a.zone_id = z.id AND a.status NOT IN ('deceased', 'transferred')) AS animal_count
    FROM zones z`;

function traducirError(error: unknown): never {
  if (esErrorPg(error, PG_UNIQUE_VIOLATION)) throw new ZoneNameTakenError();
  if (esErrorPg(error, PG_FOREIGN_KEY_VIOLATION) || esErrorPg(error, PG_RESTRICT_VIOLATION)) throw new ZoneInUseError();
  throw error;
}

export async function list(db: Queryable): Promise<ZoneDto[]> {
  const { rows } = await db.query<ZoneRow>(`${SELECT} ORDER BY z.name, z.id`);
  return rows.map(mapRow);
}

export async function findById(db: Queryable, id: number): Promise<ZoneDto | null> {
  const { rows } = await db.query<ZoneRow>(`${SELECT} WHERE z.id = $1`, [id]);
  return rows[0] ? mapRow(rows[0]) : null;
}

/** ¿Existe y está activa? Las zonas desactivadas no admiten tareas ni animales nuevos. */
export async function isActive(db: Queryable, id: number): Promise<boolean | null> {
  const { rows } = await db.query<{ is_active: boolean }>('SELECT is_active FROM zones WHERE id = $1', [id]);
  return rows[0]?.is_active ?? null;
}

export async function create(db: Queryable, datos: ZoneData): Promise<number> {
  const { rows } = await db
    .query<{ id: number }>('INSERT INTO zones (name, description, is_active) VALUES ($1, $2, $3) RETURNING id', [
      datos.name,
      datos.description ?? null,
      datos.isActive,
    ])
    .catch(traducirError);
  return rows[0]!.id;
}

/** `false` si no existe. */
export async function update(db: Queryable, id: number, datos: ZoneData): Promise<boolean> {
  const { rowCount } = await db
    .query('UPDATE zones SET name = $2, description = $3, is_active = $4 WHERE id = $1', [
      id,
      datos.name,
      datos.description ?? null,
      datos.isActive,
    ])
    .catch(traducirError);
  return (rowCount ?? 0) > 0;
}

/** `false` si no existe; si algo la usa (animales, plantillas, tareas…), ZONE_IN_USE. */
export async function remove(db: Queryable, id: number): Promise<boolean> {
  const { rowCount } = await db.query('DELETE FROM zones WHERE id = $1', [id]).catch(traducirError);
  return (rowCount ?? 0) > 0;
}
