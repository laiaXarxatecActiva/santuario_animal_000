import type { AdoptionEndReason, HistoryEventDto, HistoryEventType, PaymentMode } from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';

// CU-15: historial de «Mis animales». El alta, los pagos, la baja pedida y el
// cierre salen de adoptions y payments (así se ve también lo anterior a la tabla
// adoption_events); los cambios de plan y de forma de pago, las pausas y las
// reanudaciones, de adoption_events (los apunta el trigger adoptions_record_event).

export interface HistoryFilters {
  /** Primer día que se muestra, `YYYY-MM-DD` (zona del santuario). */
  since: string;
  animalId?: number;
}

const SUCESOS = `
  WITH mias AS (
    SELECT ad.*, an.name AS animal_name
      FROM adoptions ad
      JOIN animals an ON an.id = ad.animal_id
     WHERE ad.user_id = $1 AND ($3::int IS NULL OR ad.animal_id = $3)
  ),
  sucesos AS (
    -- Alta, con el plan con el que empezó (si después cambió, el de antes del primer cambio).
    SELECT 'adopted-' || m.id AS id, 'adopted' AS type, m.created_at AS at, m.id AS adoption_id,
           NULL::numeric AS amount, NULL::date AS period_start,
           p.name AS plan_name, NULL::text AS previous_plan_name, NULL::text AS payment_mode,
           NULL::text AS end_status, NULL::text AS end_reason
      FROM mias m
      JOIN adoption_plans p ON p.id = COALESCE(
             (SELECT e.from_plan_id FROM adoption_events e
               WHERE e.adoption_id = m.id AND e.type = 'plan_changed'
               ORDER BY e.created_at, e.id LIMIT 1),
             m.plan_id)
    UNION ALL
    -- Cuotas cobradas (también las que se devolvieron después).
    SELECT 'payment-' || pg.id || '-completed', 'payment_completed', pg.paid_at, m.id,
           pg.amount, pg.period_start, NULL, NULL, NULL, NULL, NULL
      FROM mias m JOIN payments pg ON pg.adoption_id = m.id
     WHERE pg.status IN ('completed', 'refunded') AND pg.paid_at IS NOT NULL
    UNION ALL
    SELECT 'payment-' || pg.id || '-failed', 'payment_failed', pg.created_at, m.id,
           pg.amount, pg.period_start, NULL, NULL, NULL, NULL, NULL
      FROM mias m JOIN payments pg ON pg.adoption_id = m.id
     WHERE pg.status = 'failed'
    UNION ALL
    SELECT 'payment-' || pg.id || '-refunded', 'payment_refunded', pg.refunded_at, m.id,
           pg.amount, pg.period_start, NULL, NULL, NULL, NULL, NULL
      FROM mias m JOIN payments pg ON pg.adoption_id = m.id
     WHERE pg.status = 'refunded' AND pg.refunded_at IS NOT NULL
    UNION ALL
    -- CU-21: la baja pedida, si la adopción siguió activa después: sigue activa o
    -- terminó otro día. Si se cerró en el acto (pendiente o pausada), ya lo cuenta el cierre.
    SELECT 'cancel-' || m.id, 'cancel_requested', m.cancel_requested_at, m.id,
           NULL, NULL, NULL, NULL, NULL, NULL, NULL
      FROM mias m
     WHERE m.cancel_requested_at IS NOT NULL
       AND (m.status = 'active'
            OR m.end_date > (m.cancel_requested_at AT TIME ZONE 'Europe/Madrid')::date)
    UNION ALL
    -- Cierre: al final de su último día, para que vaya después de lo demás de ese día.
    SELECT 'ended-' || m.id, 'ended',
           ((COALESCE(m.end_date, (m.updated_at AT TIME ZONE 'Europe/Madrid')::date) + 1)::timestamp
             AT TIME ZONE 'Europe/Madrid') - INTERVAL '1 second',
           m.id, NULL, NULL, NULL, NULL, NULL, m.status, m.end_reason
      FROM mias m
     WHERE m.status IN ('cancelled', 'finished')
    UNION ALL
    SELECT 'event-' || e.id, e.type, e.created_at, m.id,
           NULL, NULL, hacia.name, desde.name, e.payment_mode, NULL, NULL
      FROM mias m
      JOIN adoption_events e ON e.adoption_id = m.id
      LEFT JOIN adoption_plans desde ON desde.id = e.from_plan_id
      LEFT JOIN adoption_plans hacia ON hacia.id = e.to_plan_id
  )
  SELECT s.*, m.animal_id, m.animal_name
    FROM sucesos s
    JOIN mias m ON m.id = s.adoption_id
   WHERE s.at >= ($2::date::timestamp AT TIME ZONE 'Europe/Madrid')`;

interface HistoryRow {
  id: string;
  type: HistoryEventType;
  date: string;
  amount: string | null;
  period_start: string | null;
  plan_name: string | null;
  previous_plan_name: string | null;
  payment_mode: PaymentMode | null;
  end_status: 'cancelled' | 'finished' | null;
  end_reason: AdoptionEndReason | null;
  animal_id: number;
  animal_name: string;
}

function mapRow(row: HistoryRow): HistoryEventDto {
  return {
    id: row.id,
    type: row.type,
    date: row.date,
    animal: { id: row.animal_id, name: row.animal_name },
    amount: row.amount,
    periodStart: row.period_start,
    planName: row.plan_name,
    previousPlanName: row.previous_plan_name,
    paymentMode: row.payment_mode,
    endStatus: row.end_status,
    endReason: row.end_reason,
  };
}

const parametros = (userId: number, filtros: HistoryFilters) => [userId, filtros.since, filtros.animalId ?? null];

export async function countHistory(db: Queryable, userId: number, filtros: HistoryFilters): Promise<number> {
  const { rows } = await db.query<{ total: number }>(
    `SELECT count(*)::int AS total FROM (${SUCESOS}) h`,
    parametros(userId, filtros),
  );
  return rows[0]?.total ?? 0;
}

/** Del más reciente al más antiguo. */
export async function listHistory(
  db: Queryable,
  userId: number,
  filtros: HistoryFilters,
  { limit, offset }: { limit: number; offset: number },
): Promise<HistoryEventDto[]> {
  const { rows } = await db.query<HistoryRow>(
    `SELECT h.id, h.type, to_char(h.at AT TIME ZONE 'Europe/Madrid', 'YYYY-MM-DD') AS date,
            h.amount, h.period_start, h.plan_name, h.previous_plan_name, h.payment_mode,
            h.end_status, h.end_reason, h.animal_id, h.animal_name
       FROM (${SUCESOS}) h
      ORDER BY h.at DESC, h.id DESC
      LIMIT $4 OFFSET $5`,
    [...parametros(userId, filtros), limit, offset],
  );
  return rows.map(mapRow);
}
