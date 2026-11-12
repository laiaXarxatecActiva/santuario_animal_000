import type { Visibility } from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';

export interface AnimalUpdate {
  id: number;
  title: string;
  body: string;
  visibility: Visibility;
  publishedAt: string;
}

interface AnimalUpdateRow {
  id: number;
  title: string;
  body: string;
  visibility: Visibility;
  published_at: Date;
}

export function mapRow(row: AnimalUpdateRow): AnimalUpdate {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    visibility: row.visibility,
    publishedAt: row.published_at.toISOString(),
  };
}

export async function countPublicByAnimal(db: Queryable, animalId: number): Promise<number> {
  const { rows } = await db.query<{ total: number }>(
    `SELECT count(*)::int AS total FROM animal_updates WHERE animal_id = $1 AND visibility = 'public'`,
    [animalId],
  );
  return rows[0]?.total ?? 0;
}

/** Actualizaciones públicas de un animal, las más recientes primero. */
export async function listPublicByAnimal(
  db: Queryable,
  animalId: number,
  opciones: { limit: number; offset: number },
): Promise<AnimalUpdate[]> {
  const { rows } = await db.query<AnimalUpdateRow>(
    `SELECT id, title, body, visibility, published_at
       FROM animal_updates
      WHERE animal_id = $1 AND visibility = 'public'
      ORDER BY published_at DESC, id DESC
      LIMIT $2 OFFSET $3`,
    [animalId, opciones.limit, opciones.offset],
  );
  return rows.map(mapRow);
}
