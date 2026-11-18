import type {
  AdminAdoptionPaymentDto,
  ManualPaymentMethod,
  PaymentDto,
  PaymentMethod,
  PaymentStatus,
} from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';
import { esErrorPg, PG_UNIQUE_VIOLATION } from '../db/pg-errors.js';
import { PaymentAlreadyCompletedError } from '../errors/app-error.js';

interface PaymentRow {
  id: number;
  status: PaymentStatus;
  amount: string;
  period_start: string;
  period_end: string;
  failure_reason: string | null;
}

export function mapRow(row: PaymentRow): PaymentDto {
  return {
    id: row.id,
    status: row.status,
    amount: row.amount,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    failureReason: row.failure_reason,
  };
}

export interface NewPayment {
  adoptionId: number;
  /** Plan con el que se cobra la cuota. Sin él, el plan actual de la adopción. */
  planId?: number;
  amount: string;
  periodStart: string;
  periodEnd: string;
  status: 'completed' | 'failed';
  reference: string;
  failureReason: string | null;
  paidAt: Date | null;
}

/** Cuota de la pasarela simulada. Los pagos nunca se borran; un reintento crea otro. */
export async function create(db: Queryable, pago: NewPayment): Promise<PaymentDto> {
  try {
    const { rows } = await db.query<PaymentRow>(
      `INSERT INTO payments (adoption_id, plan_id, amount, period_start, period_end, method, status,
                             payment_reference, failure_reason, paid_at)
       VALUES ($1, COALESCE($9::int, (SELECT plan_id FROM adoptions WHERE id = $1)),
               $2, $3, $4, 'simulated', $5, $6, $7, $8)
       RETURNING id, status, amount, period_start, period_end, failure_reason`,
      [
        pago.adoptionId,
        pago.amount,
        pago.periodStart,
        pago.periodEnd,
        pago.status,
        pago.reference,
        pago.failureReason,
        pago.paidAt,
        pago.planId ?? null,
      ],
    );
    return mapRow(rows[0] as PaymentRow);
  } catch (error) {
    if (esErrorPg(error, PG_UNIQUE_VIOLATION, 'payments_one_valid_per_period'))
      throw new PaymentAlreadyCompletedError();
    throw error;
  }
}

/** CU-43 2a: ya hay un pago válido (cobrado o en curso) de ese periodo. */
export async function existsValidForPeriod(db: Queryable, adoptionId: number, periodStart: string): Promise<boolean> {
  const { rowCount } = await db.query(
    "SELECT 1 FROM payments WHERE adoption_id = $1 AND period_start = $2 AND status IN ('pending', 'completed')",
    [adoptionId, periodStart],
  );
  return (rowCount ?? 0) > 0;
}

/**
 * CU-37 alta manual (y CU-38 A2): pago cobrado fuera de la web, en efectivo o
 * por transferencia, con el administrador que lo registra.
 */
export async function createManual(
  db: Queryable,
  pago: {
    adoptionId: number;
    planId: number;
    amount: string;
    periodStart: string;
    periodEnd: string;
    method: ManualPaymentMethod;
    reference: string;
    paidAt: Date;
    recordedBy: number;
  },
): Promise<void> {
  try {
    await db.query(
      `INSERT INTO payments (adoption_id, plan_id, amount, period_start, period_end, method, status,
                             payment_reference, paid_at, recorded_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'completed', $7, $8, $9)`,
      [
        pago.adoptionId,
        pago.planId,
        pago.amount,
        pago.periodStart,
        pago.periodEnd,
        pago.method,
        pago.reference,
        pago.paidAt,
        pago.recordedBy,
      ],
    );
  } catch (error) {
    if (esErrorPg(error, PG_UNIQUE_VIOLATION, 'payments_one_valid_per_period'))
      throw new PaymentAlreadyCompletedError();
    throw error;
  }
}

/** CU-37 paso 3: pagos de una adopción, los más recientes primero. */
export async function listByAdoptionForAdmin(db: Queryable, adoptionId: number): Promise<AdminAdoptionPaymentDto[]> {
  const { rows } = await db.query<{
    id: number;
    amount: string;
    period_start: string;
    period_end: string;
    method: PaymentMethod;
    status: PaymentStatus;
    payment_reference: string;
    paid_at: Date | null;
    refunded_at: Date | null;
    failure_reason: string | null;
    recorded_by_id: number | null;
    recorded_by_name: string | null;
  }>(
    `SELECT pa.id, pa.amount, pa.period_start, pa.period_end, pa.method, pa.status, pa.payment_reference,
            pa.paid_at, pa.refunded_at, pa.failure_reason,
            r.id AS recorded_by_id, r.first_name || ' ' || r.last_name AS recorded_by_name
       FROM payments pa
       LEFT JOIN users r ON r.id = pa.recorded_by
      WHERE pa.adoption_id = $1
      ORDER BY pa.period_start DESC, pa.id DESC`,
    [adoptionId],
  );
  return rows.map((r) => ({
    id: r.id,
    amount: r.amount,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    method: r.method,
    status: r.status,
    reference: r.payment_reference,
    paidAt: r.paid_at?.toISOString() ?? null,
    refundedAt: r.refunded_at?.toISOString() ?? null,
    failureReason: r.failure_reason,
    recordedBy: r.recorded_by_id === null ? null : { id: r.recorded_by_id, name: r.recorded_by_name ?? '' },
  }));
}
