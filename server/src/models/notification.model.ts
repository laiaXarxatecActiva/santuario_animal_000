import type { NotificationType } from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';

/** Notificación de la campana (la lista y la lectura llegarán con CU-18). */
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
