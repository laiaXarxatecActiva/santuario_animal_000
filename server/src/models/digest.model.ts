import type { Language } from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';
import { ZONA_HORARIA_SANTUARIO } from '../dominio/reloj.js';

// CU-46 Resumen mensual.

export interface DestinatarioResumen {
  userId: number;
  firstName: string;
  email: string;
  language: Language;
}

/**
 * Paso 1: adoptantes activos con resumen mensual (RN-19) que aún no lo han
 * recibido para el mes que empieza en `desde`.
 */
export async function listRecipients(db: Queryable, desde: string): Promise<DestinatarioResumen[]> {
  const { rows } = await db.query<{ id: number; first_name: string; email: string; preferred_language: Language }>(
    `SELECT id, first_name, email, preferred_language FROM users
      WHERE role = 'adopter' AND is_active AND email_notifications AND email_frequency = 'monthly_digest'
        AND digest_sent_for IS DISTINCT FROM $1::date
      ORDER BY id`,
    [desde],
  );
  return rows.map((r) => ({ userId: r.id, firstName: r.first_name, email: r.email, language: r.preferred_language }));
}

export interface ActualizacionResumen {
  id: number;
  animalId: number;
  animalName: string;
  title: string;
  body: string;
}

/** Paso 1: actualizaciones del mes (zona del santuario) de los animales con adopción activa del usuario. */
export async function listUpdates(
  db: Queryable,
  userId: number,
  periodo: { desde: string; hasta: string },
): Promise<ActualizacionResumen[]> {
  const { rows } = await db.query<{ id: number; animal_id: number; name: string; title: string; body: string }>(
    `SELECT u.id, u.animal_id, an.name, u.title, u.body
       FROM animal_updates u
       JOIN animals an ON an.id = u.animal_id
      WHERE u.animal_id IN (SELECT animal_id FROM adoptions WHERE user_id = $1 AND status = 'active')
        AND (u.published_at AT TIME ZONE '${ZONA_HORARIA_SANTUARIO}')::date BETWEEN $2::date AND $3::date
      ORDER BY an.name, u.published_at, u.id`,
    [userId, periodo.desde, periodo.hasta],
  );
  return rows.map((r) => ({ id: r.id, animalId: r.animal_id, animalName: r.name, title: r.title, body: r.body }));
}

/** Postcondición: un resumen al mes como máximo. */
export async function markSent(db: Queryable, userId: number, desde: string): Promise<void> {
  await db.query('UPDATE users SET digest_sent_for = $2 WHERE id = $1', [userId, desde]);
}
