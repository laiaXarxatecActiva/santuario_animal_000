import type { Language, NotificationDto, NotificationType } from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';
import { ZONA_HORARIA_SANTUARIO } from '../dominio/reloj.js';

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

/**
 * Fase 3: un texto por idioma; se guarda el del idioma de cada destinatario.
 * Con un solo texto, el mismo para todos.
 */
export type MensajeAviso = string | Record<Language, string>;

const textos = (m: MensajeAviso): [string, string, string] => (typeof m === 'string' ? [m, m, m] : [m.es, m.ca, m.en]);

/** Elige en SQL el texto del idioma del usuario `u`; los textos van en los parámetros `$n`, `$n+1` y `$n+2`. */
const SEGUN_IDIOMA = (n: number) =>
  `CASE u.preferred_language WHEN 'ca' THEN $${n + 1}::text WHEN 'en' THEN $${n + 2}::text ELSE $${n}::text END`;

export async function create(
  db: Queryable,
  datos: { userId: number; type: NotificationType; message: MensajeAviso; link: string | null },
): Promise<void> {
  await db.query(
    `INSERT INTO notifications (user_id, type, message, link)
     SELECT u.id, $2, ${SEGUN_IDIOMA(4)}, $3 FROM users u WHERE u.id = $1`,
    [datos.userId, datos.type, datos.link, ...textos(datos.message)],
  );
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

/** La misma notificación para varios usuarios (CU-31 paso 4.1, CU-33 paso 6). */
export async function createForUsers(
  db: Queryable,
  userIds: readonly number[],
  datos: { type: NotificationType; message: MensajeAviso; link: string | null },
): Promise<void> {
  if (userIds.length === 0) return;
  await db.query(
    `INSERT INTO notifications (user_id, type, message, link)
     SELECT u.id, $2, ${SEGUN_IDIOMA(4)}, $3 FROM users u WHERE u.id = ANY($1::int[]) ORDER BY u.id`,
    [userIds, datos.type, datos.link, ...textos(datos.message)],
  );
}

/**
 * CU-47 paso 2: aviso `update_reminder` de un animal a cada trabajador activo,
 * salvo a quien ya lo tiene hoy (zona del santuario). Devuelve cuántos se crean.
 */
export async function createUpdateReminders(
  db: Queryable,
  datos: { message: MensajeAviso; link: string; hoy: string; ahora: Date },
): Promise<number> {
  const [es, ca, en] = textos(datos.message);
  const { rowCount } = await db.query(
    `INSERT INTO notifications (user_id, type, message, link, created_at)
     SELECT u.id, 'update_reminder',
            CASE u.preferred_language WHEN 'ca' THEN $5::text WHEN 'en' THEN $6::text ELSE $1::text END,
            $2::text, $4::timestamptz
       FROM users u
      WHERE u.role IN ('caretaker', 'admin') AND u.is_active
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
           WHERE n.user_id = u.id AND n.type = 'update_reminder' AND n.link = $2::text
             AND (n.created_at AT TIME ZONE '${ZONA_HORARIA_SANTUARIO}')::date = $3::date)`,
    [es, datos.link, datos.hoy, datos.ahora, ca, en],
  );
  return rowCount ?? 0;
}
