import type { Queryable } from '../db/pool.js';
import { hashToken } from '../utils/tokens.js';

// Sesiones de express-session en `user_sessions` (TECH_SPEC §9.1). Todas las
// funciones reciben el identificador de la cookie y lo convierten aquí en su
// SHA-256, de modo que el identificador nunca llega a la base de datos.

/** Datos de la sesión tal como los guarda express-session (JSON). */
export type SessionJson = Record<string, unknown>;

function userIdDe(sess: SessionJson): number | null {
  return typeof sess.userId === 'number' ? sess.userId : null;
}

/** Sesión vigente o `null` (no existe o ya ha caducado en el servidor). */
export async function find(db: Queryable, sid: string): Promise<SessionJson | null> {
  const { rows } = await db.query<{ sess: SessionJson }>(
    'SELECT sess FROM user_sessions WHERE sid_hash = $1 AND expire > NOW()',
    [hashToken(sid)],
  );
  return rows[0]?.sess ?? null;
}

/** Crea o sustituye la sesión. */
export async function save(db: Queryable, sid: string, sess: SessionJson, expire: Date): Promise<void> {
  await db.query(
    `INSERT INTO user_sessions (sid_hash, user_id, sess, expire) VALUES ($1, $2, $3, $4)
     ON CONFLICT (sid_hash) DO UPDATE SET user_id = EXCLUDED.user_id, sess = EXCLUDED.sess, expire = EXCLUDED.expire`,
    [hashToken(sid), userIdDe(sess), JSON.stringify(sess), expire],
  );
}

/** Alarga la caducidad (`rolling: true`). */
export async function touch(db: Queryable, sid: string, expire: Date): Promise<void> {
  await db.query('UPDATE user_sessions SET expire = $2 WHERE sid_hash = $1', [hashToken(sid), expire]);
}

export async function destroy(db: Queryable, sid: string): Promise<void> {
  await db.query('DELETE FROM user_sessions WHERE sid_hash = $1', [hashToken(sid)]);
}

/** Borra las sesiones caducadas y devuelve cuántas. */
export async function deleteExpired(db: Queryable): Promise<number> {
  const { rowCount } = await db.query('DELETE FROM user_sessions WHERE expire <= NOW()');
  return rowCount ?? 0;
}

/** Cierra todas las sesiones de un usuario (CU-10). */
export async function deleteByUserId(db: Queryable, userId: number): Promise<void> {
  await db.query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);
}

/** CU-24 paso 3: cierra las demás sesiones del usuario y mantiene la actual. */
export async function deleteOthersByUserId(db: Queryable, userId: number, currentSid: string): Promise<void> {
  await db.query('DELETE FROM user_sessions WHERE user_id = $1 AND sid_hash <> $2', [userId, hashToken(currentSid)]);
}
