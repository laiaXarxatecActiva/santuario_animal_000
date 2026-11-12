import type { SpeciesAdminDto, SpeciesSummary } from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';
import { esErrorPg, PG_UNIQUE_VIOLATION } from '../db/pg-errors.js';
import { SpeciesAlreadyExistsError } from '../errors/app-error.js';

export interface SpeciesData {
  name: string;
  scientificName: string | null;
  description: string | null;
}

interface SpeciesRow {
  id: number;
  name: string;
  scientific_name: string | null;
}

export function mapRow(row: SpeciesRow): SpeciesSummary {
  return { id: row.id, name: row.name, scientificName: row.scientific_name };
}

export async function listAll(db: Queryable): Promise<SpeciesSummary[]> {
  const { rows } = await db.query<SpeciesRow>('SELECT id, name, scientific_name FROM species ORDER BY name, id');
  return rows.map(mapRow);
}

// --- Panel (CU-30) ---

interface SpeciesAdminRow extends SpeciesRow {
  description: string | null;
  animal_count: number;
}

function mapAdminRow(row: SpeciesAdminRow): SpeciesAdminDto {
  return { ...mapRow(row), description: row.description, animalCount: row.animal_count };
}

const SELECT_ADMIN = `
  SELECT s.id, s.name, s.scientific_name, s.description,
         (SELECT count(*)::int FROM animals a WHERE a.species_id = s.id) AS animal_count
    FROM species s`;

/** 4a: el índice único `species_name_lower_key` impide nombres repetidos. */
function traducirError(error: unknown): never {
  if (esErrorPg(error, PG_UNIQUE_VIOLATION, 'species_name_lower_key')) throw new SpeciesAlreadyExistsError();
  throw error;
}

export async function listWithCounts(db: Queryable): Promise<SpeciesAdminDto[]> {
  const { rows } = await db.query<SpeciesAdminRow>(`${SELECT_ADMIN} ORDER BY s.name, s.id`);
  return rows.map(mapAdminRow);
}

export async function findWithCount(db: Queryable, id: number): Promise<SpeciesAdminDto | null> {
  const { rows } = await db.query<SpeciesAdminRow>(`${SELECT_ADMIN} WHERE s.id = $1`, [id]);
  return rows[0] ? mapAdminRow(rows[0]) : null;
}

export async function exists(db: Queryable, id: number): Promise<boolean> {
  const { rowCount } = await db.query('SELECT 1 FROM species WHERE id = $1', [id]);
  return rowCount === 1;
}

export async function create(db: Queryable, datos: SpeciesData): Promise<number> {
  try {
    const { rows } = await db.query<{ id: number }>(
      'INSERT INTO species (name, scientific_name, description) VALUES ($1, $2, $3) RETURNING id',
      [datos.name, datos.scientificName, datos.description],
    );
    return rows[0]!.id;
  } catch (error) {
    traducirError(error);
  }
}

/** Devuelve `false` si la especie no existe. */
export async function update(db: Queryable, id: number, datos: SpeciesData): Promise<boolean> {
  try {
    const { rowCount } = await db.query(
      'UPDATE species SET name = $2, scientific_name = $3, description = $4 WHERE id = $1',
      [id, datos.name, datos.scientificName, datos.description],
    );
    return rowCount === 1;
  } catch (error) {
    traducirError(error);
  }
}

export async function remove(db: Queryable, id: number): Promise<boolean> {
  const { rowCount } = await db.query('DELETE FROM species WHERE id = $1', [id]);
  return rowCount === 1;
}
