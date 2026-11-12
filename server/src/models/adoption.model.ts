import type { Queryable } from '../db/pool.js';

/**
 * Nombres de pila de los adoptantes con una adopción activa del animal que han
 * aceptado aparecer en la ficha pública (RN-16).
 */
export async function listPublicAdopterNames(db: Queryable, animalId: number): Promise<string[]> {
  const { rows } = await db.query<{ first_name: string }>(
    `SELECT u.first_name
       FROM adoptions ad
       JOIN users u ON u.id = ad.user_id
      WHERE ad.animal_id = $1 AND ad.status = 'active' AND u.show_public_name AND u.anonymized_at IS NULL
      ORDER BY ad.start_date, ad.id`,
    [animalId],
  );
  return rows.map((row) => row.first_name);
}
