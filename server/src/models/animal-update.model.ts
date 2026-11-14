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

// ----------------------------------------------------------------------------
// Panel (CU-31 y CU-32)
// ----------------------------------------------------------------------------

export interface AdminUpdateRecord {
  id: number;
  animal: { id: number; name: string };
  author: { id: number; name: string };
  title: string;
  body: string;
  visibility: Visibility;
  publishedAt: string;
  updatedAt: string;
  photoCount: number;
}

interface AdminUpdateRow {
  id: number;
  animal_id: number;
  animal_name: string;
  author_id: number;
  author_name: string;
  title: string;
  body: string;
  visibility: Visibility;
  published_at: Date;
  updated_at: Date;
  photo_count: number;
}

export function mapAdminRow(row: AdminUpdateRow): AdminUpdateRecord {
  return {
    id: row.id,
    animal: { id: row.animal_id, name: row.animal_name },
    author: { id: row.author_id, name: row.author_name },
    title: row.title,
    body: row.body,
    visibility: row.visibility,
    publishedAt: row.published_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    photoCount: row.photo_count,
  };
}

const SELECT_ADMIN = `
  SELECT u.id, u.animal_id, a.name AS animal_name, u.author_id,
         au.first_name || ' ' || au.last_name AS author_name,
         u.title, u.body, u.visibility, u.published_at, u.updated_at,
         (SELECT count(*)::int FROM photos p WHERE p.update_id = u.id) AS photo_count
    FROM animal_updates u
    JOIN animals a ON a.id = u.animal_id
    JOIN users au ON au.id = u.author_id`;

export interface AdminUpdateFilters {
  animalId?: number;
  visibility?: Visibility;
  authorId?: number;
}

function filtroAdmin(filtros: AdminUpdateFilters): { where: string; params: unknown[] } {
  const params: unknown[] = [];
  const condiciones = ['TRUE'];
  const añadir = (columna: string, valor: unknown) => {
    params.push(valor);
    condiciones.push(`${columna} = $${params.length}`);
  };
  if (filtros.animalId !== undefined) añadir('u.animal_id', filtros.animalId);
  if (filtros.visibility !== undefined) añadir('u.visibility', filtros.visibility);
  if (filtros.authorId !== undefined) añadir('u.author_id', filtros.authorId);
  return { where: condiciones.join(' AND '), params };
}

export async function countAdmin(db: Queryable, filtros: AdminUpdateFilters): Promise<number> {
  const { where, params } = filtroAdmin(filtros);
  const { rows } = await db.query<{ total: number }>(
    `SELECT count(*)::int AS total FROM animal_updates u WHERE ${where}`,
    params,
  );
  return rows[0]?.total ?? 0;
}

export async function listAdmin(
  db: Queryable,
  filtros: AdminUpdateFilters,
  pagina: { limit: number; offset: number },
): Promise<AdminUpdateRecord[]> {
  const { where, params } = filtroAdmin(filtros);
  params.push(pagina.limit, pagina.offset);
  const { rows } = await db.query<AdminUpdateRow>(
    `${SELECT_ADMIN} WHERE ${where} ORDER BY ${ORDEN} LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows.map(mapAdminRow);
}

export async function findAdminById(
  db: Queryable,
  id: number,
  opciones: { forUpdate?: boolean } = {},
): Promise<AdminUpdateRecord | null> {
  const { rows } = await db.query<AdminUpdateRow>(
    `${SELECT_ADMIN} WHERE u.id = $1${opciones.forUpdate ? ' FOR UPDATE OF u' : ''}`,
    [id],
  );
  return rows[0] ? mapAdminRow(rows[0]) : null;
}

export interface UpdateContent {
  title: string;
  body: string;
  visibility: Visibility;
}

/** CU-31 paso 3: autor = el trabajador, `published_at` = ahora (del Reloj). */
export async function insert(
  db: Queryable,
  datos: UpdateContent & { animalId: number; authorId: number; publishedAt: Date },
): Promise<number> {
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO animal_updates (animal_id, author_id, title, body, visibility, published_at)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [datos.animalId, datos.authorId, datos.title, datos.body, datos.visibility, datos.publishedAt],
  );
  return rows[0]!.id;
}

/** CU-32: la fecha de publicación no cambia (no se vuelve a notificar). */
export async function updateContent(db: Queryable, id: number, datos: UpdateContent): Promise<void> {
  await db.query('UPDATE animal_updates SET title = $2, body = $3, visibility = $4 WHERE id = $1', [
    id,
    datos.title,
    datos.body,
    datos.visibility,
  ]);
}

/** CU-32: sus fotos y marcas de lectura se borran en cascada. */
export async function remove(db: Queryable, id: number): Promise<void> {
  await db.query('DELETE FROM animal_updates WHERE id = $1', [id]);
}
