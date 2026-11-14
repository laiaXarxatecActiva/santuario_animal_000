import type { AdminPhotoDto, MediaType, PhotoDto, Visibility } from '@sanctuary/shared';
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

// ----------------------------------------------------------------------------
// Panel (CU-29 y CU-31): todas las fotos, con su orden y si son la portada
// ----------------------------------------------------------------------------

export interface AdminPhoto extends AdminPhotoDto {
  animalId: number;
  updateId: number | null;
}

interface AdminPhotoRow extends PhotoRow {
  animal_id: number;
  update_id: number | null;
  sort_order: number;
  is_cover: boolean;
}

export function mapAdminRow(row: AdminPhotoRow): AdminPhoto {
  return {
    ...mapRow(row),
    sortOrder: row.sort_order,
    isCover: row.is_cover,
    animalId: row.animal_id,
    updateId: row.update_id,
  };
}

/** Quita los campos internos antes de responder. */
export function toAdminDto({ animalId: _a, updateId: _u, ...dto }: AdminPhoto): AdminPhotoDto {
  return dto;
}

const SELECT_ADMIN = `
  SELECT ${COLUMNAS}, p.animal_id, p.update_id, p.sort_order, a.cover_photo_id IS NOT DISTINCT FROM p.id AS is_cover
    FROM photos p
    JOIN animals a ON a.id = p.animal_id`;

/** Galería de un animal en el panel (todas las visibilidades), en su orden. */
export async function listGalleryAdmin(db: Queryable, animalId: number): Promise<AdminPhoto[]> {
  const { rows } = await db.query<AdminPhotoRow>(
    `${SELECT_ADMIN} WHERE p.animal_id = $1 AND p.update_id IS NULL ORDER BY p.sort_order, p.id`,
    [animalId],
  );
  return rows.map(mapAdminRow);
}

/** Fotos de una actualización en el panel, en su orden. */
export async function listByUpdateAdmin(db: Queryable, updateId: number): Promise<AdminPhoto[]> {
  const { rows } = await db.query<AdminPhotoRow>(`${SELECT_ADMIN} WHERE p.update_id = $1 ORDER BY p.sort_order, p.id`, [
    updateId,
  ]);
  return rows.map(mapAdminRow);
}

export async function findAdminById(
  db: Queryable,
  id: number,
  opciones: { forUpdate?: boolean } = {},
): Promise<AdminPhoto | null> {
  const { rows } = await db.query<AdminPhotoRow>(
    `${SELECT_ADMIN} WHERE p.id = $1${opciones.forUpdate ? ' FOR UPDATE OF p' : ''}`,
    [id],
  );
  return rows[0] ? mapAdminRow(rows[0]) : null;
}

export interface NewPhoto {
  animalId: number;
  updateId: number | null;
  mediaType: MediaType;
  url: string;
  thumbnailUrl: string | null;
  altText: string;
  visibility: Visibility;
  uploadedBy: number;
}

/**
 * Inserta las fotos detrás de las que ya hay (de la galería o de la
 * actualización) y devuelve sus ids en el mismo orden.
 */
export async function insertMany(db: Queryable, fotos: NewPhoto[]): Promise<number[]> {
  const ids: number[] = [];
  for (const f of fotos) {
    const { rows } = await db.query<{ id: number }>(
      `INSERT INTO photos (animal_id, update_id, media_type, url, thumbnail_url, alt_text, visibility, uploaded_by, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
               (SELECT COALESCE(max(sort_order) + 1, 0) FROM photos
                 WHERE animal_id = $1 AND update_id IS NOT DISTINCT FROM $2))
       RETURNING id`,
      [f.animalId, f.updateId, f.mediaType, f.url, f.thumbnailUrl, f.altText, f.visibility, f.uploadedBy],
    );
    ids.push(rows[0]!.id);
  }
  return ids;
}

/** CU-29 A1. */
export async function updateMeta(
  db: Queryable,
  id: number,
  datos: { altText: string; visibility: Visibility },
): Promise<void> {
  await db.query('UPDATE photos SET alt_text = $2, visibility = $3 WHERE id = $1', [
    id,
    datos.altText,
    datos.visibility,
  ]);
}

/** CU-29 paso 6: la posición de cada foto es su índice en la lista. */
export async function setGalleryOrder(db: Queryable, animalId: number, photoIds: number[]): Promise<void> {
  await db.query(
    `UPDATE photos p SET sort_order = o.ord - 1
       FROM unnest($2::int[]) WITH ORDINALITY AS o(id, ord)
      WHERE p.id = o.id AND p.animal_id = $1 AND p.update_id IS NULL`,
    [animalId, photoIds],
  );
}

/** CU-32: las fotos de una actualización tienen su visibilidad. */
export async function setVisibilityForUpdate(db: Queryable, updateId: number, visibility: Visibility): Promise<void> {
  await db.query('UPDATE photos SET visibility = $2 WHERE update_id = $1', [updateId, visibility]);
}

/** Borra las fotos y devuelve sus URLs (para borrar después los archivos). */
export async function removeMany(db: Queryable, ids: number[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const { rows } = await db.query<{ url: string; thumbnail_url: string | null }>(
    'DELETE FROM photos WHERE id = ANY($1::int[]) RETURNING url, thumbnail_url',
    [ids],
  );
  return rows.flatMap((r) => (r.thumbnail_url ? [r.url, r.thumbnail_url] : [r.url]));
}
