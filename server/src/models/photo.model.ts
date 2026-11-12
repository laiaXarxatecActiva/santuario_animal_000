import type { PhotoDto } from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';

export interface PhotoRow {
  id: number;
  media_type: 'image' | 'video';
  url: string;
  thumbnail_url: string | null;
  alt_text: string;
}

export function mapRow(row: PhotoRow): PhotoDto {
  return {
    id: row.id,
    mediaType: row.media_type,
    url: row.url,
    thumbnailUrl: row.thumbnail_url,
    altText: row.alt_text,
  };
}

const COLUMNAS = 'p.id, p.media_type, p.url, p.thumbnail_url, p.alt_text';

/** Galería pública de un animal: fotos públicas que no son de una actualización, en su orden. */
export async function listPublicGallery(db: Queryable, animalId: number): Promise<PhotoDto[]> {
  const { rows } = await db.query<PhotoRow>(
    `SELECT ${COLUMNAS}
       FROM photos p
      WHERE p.animal_id = $1 AND p.update_id IS NULL AND p.visibility = 'public'
      ORDER BY p.sort_order, p.id`,
    [animalId],
  );
  return rows.map(mapRow);
}

/** Fotos públicas de varias actualizaciones, agrupadas por actualización. */
export async function listPublicByUpdates(db: Queryable, updateIds: number[]): Promise<Map<number, PhotoDto[]>> {
  const porActualizacion = new Map<number, PhotoDto[]>();
  if (updateIds.length === 0) return porActualizacion;
  const { rows } = await db.query<PhotoRow & { update_id: number }>(
    `SELECT ${COLUMNAS}, p.update_id
       FROM photos p
      WHERE p.update_id = ANY($1::int[]) AND p.visibility = 'public'
      ORDER BY p.sort_order, p.id`,
    [updateIds],
  );
  for (const row of rows) {
    const lista = porActualizacion.get(row.update_id) ?? [];
    lista.push(mapRow(row));
    porActualizacion.set(row.update_id, lista);
  }
  return porActualizacion;
}
