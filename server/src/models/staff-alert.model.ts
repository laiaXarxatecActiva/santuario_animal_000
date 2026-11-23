import type { Queryable } from '../db/pool.js';

// Avisos internos ya enviados (CU-64 en adelante): cada uno, una sola vez.

/** Anota el aviso; devuelve `false` si ya estaba anotado. */
export async function registerIfNew(db: Queryable, kind: string, refKey: string): Promise<boolean> {
  const { rowCount } = await db.query(
    'INSERT INTO staff_alerts (kind, ref_key) VALUES ($1, $2) ON CONFLICT (kind, ref_key) DO NOTHING',
    [kind, refKey],
  );
  return (rowCount ?? 0) > 0;
}
