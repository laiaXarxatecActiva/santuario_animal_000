import type { Queryable } from '../db/pool.js';

// Sesiones de express-session guardadas por connect-pg-simple en `user_sessions`.
// La sesión solo guarda `userId` (TECH_SPEC §9.1).

/** Cierra todas las sesiones de un usuario (CU-10). */
export async function deleteByUserId(db: Queryable, userId: number): Promise<void> {
  await db.query("DELETE FROM user_sessions WHERE (sess ->> 'userId')::int = $1", [userId]);
}
