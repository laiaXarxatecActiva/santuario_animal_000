import type { UserTokenType } from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';

interface UserTokenRow {
  id: number;
  user_id: number;
  type: UserTokenType;
  expires_at: Date;
  used_at: Date | null;
}

export interface UserToken {
  id: number;
  userId: number;
  type: UserTokenType;
  expiresAt: Date;
  usedAt: Date | null;
}

export function mapRow(row: UserTokenRow): UserToken {
  return { id: row.id, userId: row.user_id, type: row.type, expiresAt: row.expires_at, usedAt: row.used_at };
}

export async function create(
  db: Queryable,
  datos: { userId: number; type: UserTokenType; tokenHash: string; expiresAt: Date },
): Promise<void> {
  await db.query('INSERT INTO user_tokens (user_id, type, token_hash, expires_at) VALUES ($1, $2, $3, $4)', [
    datos.userId,
    datos.type,
    datos.tokenHash,
    datos.expiresAt,
  ]);
}

export async function findByHash(db: Queryable, tokenHash: string): Promise<UserToken | null> {
  const { rows } = await db.query<UserTokenRow>(
    'SELECT id, user_id, type, expires_at, used_at FROM user_tokens WHERE token_hash = $1',
    [tokenHash],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

/** Marca el token como usado. Devuelve `false` si ya lo estaba (dos peticiones a la vez). */
export async function markUsed(db: Queryable, id: number, instante: Date): Promise<boolean> {
  const { rowCount } = await db.query('UPDATE user_tokens SET used_at = $2 WHERE id = $1 AND used_at IS NULL', [
    id,
    instante,
  ]);
  return rowCount === 1;
}

/** Invalida los tokens pendientes de un tipo (al reenviar o al pedir otro enlace). */
export async function invalidateUnused(
  db: Queryable,
  userId: number,
  type: UserTokenType,
  instante: Date,
): Promise<void> {
  await db.query('UPDATE user_tokens SET used_at = $3 WHERE user_id = $1 AND type = $2 AND used_at IS NULL', [
    userId,
    type,
    instante,
  ]);
}
