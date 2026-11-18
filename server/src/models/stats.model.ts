import type { AdminStatsDto } from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';
import { ZONA_HORARIA_SANTUARIO } from '../dominio/reloj.js';
import type { RangoMeses } from '../dominio/estadisticas.js';

// CU-41: consultas de las estadísticas. Las sumas se hacen en SQL (sin floats)
// y los meses salen de generate_series para que aparezcan también los vacíos.

const MESES = `SELECT generate_series($1::date, $2::date, interval '1 month')::date AS mes`;

/** Lo cobrado cada mes (zona del santuario), igual que los ingresos del escritorio (CU-27). */
export async function revenueByMonth(db: Queryable, r: RangoMeses): Promise<AdminStatsDto['revenueByMonth']> {
  const { rows } = await db.query<AdminStatsDto['revenueByMonth'][number]>(
    `WITH meses AS (${MESES}),
          cobrado AS (
            SELECT 'fee' AS tipo, amount, paid_at FROM payments WHERE status = 'completed'
            UNION ALL
            SELECT 'donation', amount, paid_at FROM donations WHERE status = 'completed'
          )
     SELECT to_char(m.mes, 'YYYY-MM') AS month,
            COALESCE(sum(c.amount) FILTER (WHERE c.tipo = 'fee'), 0)::numeric(12,2)::text AS fees,
            COALESCE(sum(c.amount) FILTER (WHERE c.tipo = 'donation'), 0)::numeric(12,2)::text AS donations
       FROM meses m
       LEFT JOIN cobrado c
         ON date_trunc('month', c.paid_at AT TIME ZONE '${ZONA_HORARIA_SANTUARIO}')::date = m.mes
      GROUP BY m.mes ORDER BY m.mes`,
    [r.desde, r.hasta],
  );
  return rows;
}

/** Altas (inicio) y bajas (cierre de las que llegaron a empezar) cada mes. */
export async function adoptionsByMonth(db: Queryable, r: RangoMeses): Promise<AdminStatsDto['adoptionsByMonth']> {
  const { rows } = await db.query<AdminStatsDto['adoptionsByMonth'][number]>(
    `WITH meses AS (${MESES})
     SELECT to_char(m.mes, 'YYYY-MM') AS month,
            (SELECT count(*)::int FROM adoptions a
              WHERE a.start_date IS NOT NULL AND date_trunc('month', a.start_date)::date = m.mes) AS started,
            (SELECT count(*)::int FROM adoptions a
              WHERE a.status IN ('cancelled', 'finished') AND a.start_date IS NOT NULL
                AND a.end_date IS NOT NULL AND date_trunc('month', a.end_date)::date = m.mes) AS ended
       FROM meses m ORDER BY m.mes`,
    [r.desde, r.hasta],
  );
  return rows;
}

export async function mostAdopted(db: Queryable, limite: number): Promise<AdminStatsDto['mostAdopted']> {
  const { rows } = await db.query<{ id: number; name: string; n: number }>(
    `SELECT an.id, an.name, count(*)::int AS n
       FROM adoptions ad JOIN animals an ON an.id = ad.animal_id
      WHERE ad.status = 'active'
      GROUP BY an.id, an.name
      ORDER BY n DESC, an.name, an.id
      LIMIT $1`,
    [limite],
  );
  return rows.map((r) => ({ animal: { id: r.id, name: r.name }, activeAdoptions: r.n }));
}

export async function withoutAdopters(db: Queryable): Promise<AdminStatsDto['withoutAdopters']> {
  const { rows } = await db.query<AdminStatsDto['withoutAdopters'][number]>(
    `SELECT a.id, a.name, s.name AS species
       FROM animals a JOIN species s ON s.id = a.species_id
      WHERE a.status IN ('in_sanctuary', 'in_treatment')
        AND NOT EXISTS (SELECT 1 FROM adoptions ad WHERE ad.animal_id = a.id AND ad.status = 'active')
      ORDER BY a.arrival_date, a.id`,
  );
  return rows;
}

/** Los planes con alguna adopción activa, de más a menos. */
export async function activeByPlan(db: Queryable): Promise<AdminStatsDto['activeByPlan']> {
  const { rows } = await db.query<{ id: number; name: string; n: number }>(
    `SELECT p.id, p.name, count(*)::int AS n
       FROM adoptions ad JOIN adoption_plans p ON p.id = ad.plan_id
      WHERE ad.status = 'active'
      GROUP BY p.id, p.name
      ORDER BY n DESC, p.monthly_amount, p.id`,
  );
  return rows.map((r) => ({ plan: { id: r.id, name: r.name }, count: r.n }));
}
