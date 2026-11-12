import type { Queryable } from '../db/pool.js';

// Marcas de «leído» del muro (CU-16 paso 3, CU-17 paso 4). Sin fila = sin leer.

/** Marca la actualización como leída; repetirlo no cambia nada. */
export async function markRead(db: Queryable, userId: number, updateId: number): Promise<void> {
  await db.query(
    'INSERT INTO update_reads (user_id, update_id) VALUES ($1, $2) ON CONFLICT (user_id, update_id) DO NOTHING',
    [userId, updateId],
  );
}

/** Vuelve a dejarla sin leer. */
export async function markUnread(db: Queryable, userId: number, updateId: number): Promise<void> {
  await db.query('DELETE FROM update_reads WHERE user_id = $1 AND update_id = $2', [userId, updateId]);
}
