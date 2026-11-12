import type { PhotoDto, Visibility } from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';
import { ZONA_HORARIA_SANTUARIO } from '../dominio/reloj.js';
import { COLUMNAS_PORTADA, JOIN_PORTADA, mapCover, type CoverRow } from './photo.model.js';

export interface AnimalUpdate {
  id: number;
  title: string;
  body: string;
  visibility: Visibility;
  publishedAt: string;
  /** Solo si se consulta para un lector concreto. */
  isRead?: boolean;
}

interface AnimalUpdateRow {
  id: number;
  title: string;
  body: string;
  visibility: Visibility;
  published_at: Date;
  is_read?: boolean;
}

export function mapRow(row: AnimalUpdateRow): AnimalUpdate {
  const actualizacion: AnimalUpdate = {
    id: row.id,
    title: row.title,
    body: row.body,
    visibility: row.visibility,
    publishedAt: row.published_at.toISOString(),
  };
  if (row.is_read !== undefined) actualizacion.isRead = row.is_read;
  return actualizacion;
}

const COLUMNAS = 'u.id, u.title, u.body, u.visibility, u.published_at';
// Sin acceso exclusivo solo se ven las públicas (RN-15).
const VISIBLES = "($2::boolean OR u.visibility = 'public')";
const ORDEN = 'u.published_at DESC, u.id DESC';

export async function countByAnimal(
  db: Queryable,
  animalId: number,
  opciones: { includeAdopters: boolean },
): Promise<number> {
  const { rows } = await db.query<{ total: number }>(
    `SELECT count(*)::int AS total FROM animal_updates u WHERE u.animal_id = $1 AND ${VISIBLES}`,
    [animalId, opciones.includeAdopters],
  );
  return rows[0]?.total ?? 0;
}

/** Actualizaciones de un animal, las más recientes primero. Con `readerId`, incluye si las ha leído. */
export async function listByAnimal(
  db: Queryable,
  animalId: number,
  opciones: { includeAdopters: boolean; readerId?: number; limit: number; offset: number },
): Promise<AnimalUpdate[]> {
  const conLector = opciones.readerId !== undefined;
  const { rows } = await db.query<AnimalUpdateRow>(
    `SELECT ${COLUMNAS}${conLector ? ', r.user_id IS NOT NULL AS is_read' : ''}
       FROM animal_updates u
       ${conLector ? 'LEFT JOIN update_reads r ON r.update_id = u.id AND r.user_id = $5' : ''}
      WHERE u.animal_id = $1 AND ${VISIBLES}
      ORDER BY ${ORDEN}
      LIMIT $3 OFFSET $4`,
    [animalId, opciones.includeAdopters, opciones.limit, opciones.offset, ...(conLector ? [opciones.readerId] : [])],
  );
  return rows.map(mapRow);
}

/**
 * RN-15: la actualización es de un animal del que el usuario tiene una
 * adopción activa (sin límite de fecha, porque la ficha ampliada muestra todo).
 */
export async function isVisibleToAdopter(db: Queryable, userId: number, updateId: number): Promise<boolean> {
  const { rowCount } = await db.query(
    `SELECT 1
       FROM animal_updates u
       JOIN adoptions ad ON ad.animal_id = u.animal_id AND ad.user_id = $1 AND ad.status = 'active'
      WHERE u.id = $2`,
    [userId, updateId],
  );
  return rowCount === 1;
}

// ----------------------------------------------------------------------------
// Muro del adoptante (CU-17)
// ----------------------------------------------------------------------------

export interface FeedFilters {
  unread: boolean;
  animalId?: number;
}

export interface FeedItem extends AnimalUpdate {
  isRead: boolean;
  animal: { id: number; name: string; coverPhoto: PhotoDto | null };
}

interface FeedRow extends AnimalUpdateRow, CoverRow {
  is_read: boolean;
  animal_id: number;
  animal_name: string;
}

// Actualizaciones de los animales con adopción activa, publicadas desde el
// inicio de esa adopción (nota de CU-17). Solo hay una adopción abierta por
// animal y usuario (RN-05), así que no se repiten filas.
const DESDE_MURO = `
    FROM animal_updates u
    JOIN adoptions ad ON ad.animal_id = u.animal_id AND ad.user_id = $1 AND ad.status = 'active'
    JOIN animals a ON a.id = u.animal_id
    ${JOIN_PORTADA('a')}
    LEFT JOIN update_reads r ON r.update_id = u.id AND r.user_id = $1
   WHERE (u.published_at AT TIME ZONE '${ZONA_HORARIA_SANTUARIO}')::date >= ad.start_date
     AND ($2::int IS NULL OR u.animal_id = $2)
     AND (NOT $3::boolean OR r.user_id IS NULL)`;

const parametrosMuro = (userId: number, filtros: FeedFilters) => [userId, filtros.animalId ?? null, filtros.unread];

export async function countFeed(db: Queryable, userId: number, filtros: FeedFilters): Promise<number> {
  const { rows } = await db.query<{ total: number }>(
    `SELECT count(*)::int AS total ${DESDE_MURO}`,
    parametrosMuro(userId, filtros),
  );
  return rows[0]?.total ?? 0;
}

export async function listFeed(
  db: Queryable,
  userId: number,
  filtros: FeedFilters,
  pagina: { limit: number; offset: number },
): Promise<FeedItem[]> {
  const { rows } = await db.query<FeedRow>(
    `SELECT ${COLUMNAS}, r.user_id IS NOT NULL AS is_read, a.id AS animal_id, a.name AS animal_name,
            ${COLUMNAS_PORTADA}
       ${DESDE_MURO}
      ORDER BY ${ORDEN}
      LIMIT $4 OFFSET $5`,
    [...parametrosMuro(userId, filtros), pagina.limit, pagina.offset],
  );
  return rows.map((row) => ({
    ...mapRow(row),
    isRead: row.is_read,
    animal: { id: row.animal_id, name: row.animal_name, coverPhoto: mapCover(row) },
  }));
}
