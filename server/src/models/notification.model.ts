import type { NotificationDto, NotificationType } from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';

// Notificaciones de la campana (CU-18). Todas las consultas filtran por el
// usuario: una notificación ajena no existe para quien la pide.

interface NotificationRow {
  id: number;
  type: NotificationType;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: Date;
}

export function mapRow(row: NotificationRow): NotificationDto {
  return {
    id: row.id,
    type: row.type,
    message: row.message,
    link: row.link,
    isRead: row.is_read,
    createdAt: row.created_at.toISOString(),
  };
}

const COLUMNAS = 'id, type, message, link, is_read, created_at';
const FILTRO = 'user_id = $1 AND ($2::boolean = FALSE OR NOT is_read)';

export async function create(
  db: Queryable,
  datos: { userId: number; type: NotificationType; message: string; link: string | null },
): Promise<void> {
  await db.query('INSERT INTO notifications (user_id, type, message, link) VALUES ($1, $2, $3, $4)', [
    datos.userId,
    datos.type,
    datos.message,
    datos.link,
  ]);
}

export async function count(db: Queryable, userId: number, filtros: { unread: boolean }): Promise<number> {
  const { rows } = await db.query<{ total: number }>(
    `SELECT count(*)::int AS total FROM notifications WHERE ${FILTRO}`,
    [userId, filtros.unread],
  );
  return rows[0]?.total ?? 0;
}

export async function list(
  db: Queryable,
  userId: number,
  filtros: { unread: boolean },
  pagina: { limit: number; offset: number },
): Promise<NotificationDto[]> {
  const { rows } = await db.query<NotificationRow>(
    `SELECT ${COLUMNAS} FROM notifications WHERE ${FILTRO}
     ORDER BY created_at DESC, id DESC LIMIT $3 OFFSET $4`,
    [userId, filtros.unread, pagina.limit, pagina.offset],
  );
  return rows.map(mapRow);
}

/** Marca como leída o no leída. `null` si no existe o es de otra persona. */
export async function setRead(
  db: Queryable,
  userId: number,
  id: number,
  isRead: boolean,
): Promise<NotificationDto | null> {
  const { rows } = await db.query<NotificationRow>(
    `UPDATE notifications SET is_read = $3 WHERE id = $2 AND user_id = $1 RETURNING ${COLUMNAS}`,
    [userId, id, isRead],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function markAllRead(db: Queryable, userId: number): Promise<void> {
  await db.query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND NOT is_read', [userId]);
}

/** Borra una notificación propia. `false` si no existe o es de otra persona. */
export async function remove(db: Queryable, userId: number, id: number): Promise<boolean> {
  const { rowCount } = await db.query('DELETE FROM notifications WHERE id = $2 AND user_id = $1', [userId, id]);
  return (rowCount ?? 0) > 0;
}
