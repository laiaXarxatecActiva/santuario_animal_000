import type { AnimalStatus } from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';
import { ZONA_HORARIA_SANTUARIO } from '../dominio/reloj.js';

/** CU-27: número de animales por estado (incluye ocultos y archivados). */
export async function countAnimalsByStatus(db: Queryable): Promise<Partial<Record<AnimalStatus, number>>> {
  const { rows } = await db.query<{ status: AnimalStatus; total: number }>(
    'SELECT status, count(*)::int AS total FROM animals GROUP BY status',
  );
  return Object.fromEntries(rows.map((r) => [r.status, r.total]));
}

/** CU-27: adopciones activas y pendientes de pago. */
export async function countAdoptions(db: Queryable): Promise<{ active: number; pending: number }> {
  const { rows } = await db.query<{ active: number; pending: number }>(
    `SELECT count(*) FILTER (WHERE status = 'active')::int  AS active,
            count(*) FILTER (WHERE status = 'pending')::int AS pending
       FROM adoptions`,
  );
  return rows[0] ?? { active: 0, pending: 0 };
}

export interface AnimalConAdoptantes {
  id: number;
  name: string;
  activeAdopters: number;
  /** Día de la última actualización (zona del santuario) o, si no hay, de la primera adopción activa. */
  referenceDate: string;
}

/** RN-14: animales con adoptantes activos y la fecha desde la que se cuentan los días sin actualizar. */
export async function listAnimalsWithActiveAdopters(db: Queryable): Promise<AnimalConAdoptantes[]> {
  const { rows } = await db.query<{ id: number; name: string; active_adopters: number; reference_date: string }>(
    `SELECT an.id, an.name, count(*)::int AS active_adopters,
            to_char(COALESCE(
              (SELECT (max(u.published_at) AT TIME ZONE '${ZONA_HORARIA_SANTUARIO}')::date
                 FROM animal_updates u WHERE u.animal_id = an.id),
              min(ad.start_date)
            ), 'YYYY-MM-DD') AS reference_date
       FROM adoptions ad
       JOIN animals an ON an.id = ad.animal_id
      WHERE ad.status = 'active'
      GROUP BY an.id, an.name
      ORDER BY an.id`,
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    activeAdopters: r.active_adopters,
    referenceDate: r.reference_date,
  }));
}
