import type { PhotoDto, Visibility } from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';

export interface PhotoRow {
  id: number;
  media_type: 'image' | 'video';
  url: string;
  thumbnail_url: string | null;
  alt_text: string;
  visibility: Visibility;
}

export function mapRow(row: PhotoRow): PhotoDto {
  return {
    id: row.id,
    mediaType: row.media_type,
    url: row.url,
    thumbnailUrl: row.thumbnail_url,
    altText: row.alt_text,
    visibility: row.visibility,
  };
}

/** Columnas de la portada pública de un animal, unida como `cp` (`LEFT JOIN photos cp ...`). */
export const COLUMNAS_PORTADA = `cp.id AS cover_id, cp.media_type AS cover_media_type, cp.url AS cover_url,
       cp.thumbnail_url AS cover_thumbnail_url, cp.alt_text AS cover_alt_text`;

/** Unión con la portada del animal `alias`; solo se muestra si es pública. */
export const JOIN_PORTADA = (alias: string) =>
  `LEFT JOIN photos cp ON cp.id = ${alias}.cover_photo_id AND cp.visibility = 'public'`;

export interface CoverRow {
  cover_id: number | null;
  cover_media_type: 'image' | 'video' | null;
  cover_url: string | null;
  cover_thumbnail_url: string | null;
  cover_alt_text: string | null;
}

export function mapCover(row: CoverRow): PhotoDto | null {
  if (row.cover_id === null || row.cover_url === null) return null;
  return {
    id: row.cover_id,
    mediaType: row.cover_media_type ?? 'image',
    url: row.cover_url,
    thumbnailUrl: row.cover_thumbnail_url,
    altText: row.cover_alt_text ?? '',
    visibility: 'public',
  };
}

const COLUMNAS = 'p.id, p.media_type, p.url, p.thumbnail_url, p.alt_text, p.visibility';
// Sin acceso exclusivo solo se ven las públicas (RN-15).
const VISIBLES = "($2::boolean OR p.visibility = 'public')";

/** Galería de un animal: fotos que no son de una actualización, en su orden. */
export async function listGallery(
  db: Queryable,
  animalId: number,
  opciones: { includeAdopters: boolean },
): Promise<PhotoDto[]> {
  const { rows } = await db.query<PhotoRow>(
    `SELECT ${COLUMNAS}
       FROM photos p
      WHERE p.animal_id = $1 AND p.update_id IS NULL AND ${VISIBLES}
      ORDER BY p.sort_order, p.id`,
    [animalId, opciones.includeAdopters],
  );
  return rows.map(mapRow);
}

/** Fotos de varias actualizaciones, agrupadas por actualización. */
export async function listByUpdates(
  db: Queryable,
  updateIds: number[],
  opciones: { includeAdopters: boolean },
): Promise<Map<number, PhotoDto[]>> {
  const porActualizacion = new Map<number, PhotoDto[]>();
  if (updateIds.length === 0) return porActualizacion;
  const { rows } = await db.query<PhotoRow & { update_id: number }>(
    `SELECT ${COLUMNAS}, p.update_id
       FROM photos p
      WHERE p.update_id = ANY($1::int[]) AND ${VISIBLES}
      ORDER BY p.sort_order, p.id`,
    [updateIds, opciones.includeAdopters],
  );
  for (const row of rows) {
    const lista = porActualizacion.get(row.update_id) ?? [];
    lista.push(mapRow(row));
    porActualizacion.set(row.update_id, lista);
  }
  return porActualizacion;
}
