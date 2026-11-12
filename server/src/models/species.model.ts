import type { SpeciesSummary } from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';

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
