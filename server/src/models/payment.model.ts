import type { PaymentDto, PaymentStatus } from '@sanctuary/shared';
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
      `INSERT INTO payments (adoption_id, amount, period_start, period_end, method, status,
                             payment_reference, failure_reason, paid_at)
       VALUES ($1, $2, $3, $4, 'simulated', $5, $6, $7, $8)
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
