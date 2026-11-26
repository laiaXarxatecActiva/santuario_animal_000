import type {
  AdminAdoptionPaymentDto,
  AdminPaymentListItemDto,
  AdminPaymentSort,
  ManualPaymentMethod,
  PaymentDto,
  PaymentMethod,
  PaymentStatus,
} from '@sanctuary/shared';
import { escaparLike, sinTildes } from '../db/busqueda.js';
import type { Queryable } from '../db/pool.js';
import { ZONA_HORARIA_SANTUARIO } from '../dominio/reloj.js';
import { esErrorPg, PG_UNIQUE_VIOLATION } from '../db/pg-errors.js';
import { PaymentAlreadyCompletedError, PeriodAlreadyPaidError } from '../errors/app-error.js';

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

/** Cuota cobrada en la web con tarjeta (pasarela). Los pagos nunca se borran; un reintento crea otro. */
export async function create(db: Queryable, pago: NewPayment): Promise<PaymentDto> {
  try {
    const { rows } = await db.query<PaymentRow>(
      `INSERT INTO payments (adoption_id, plan_id, amount, period_start, period_end, method, status,
                             payment_reference, failure_reason, paid_at)
       VALUES ($1, COALESCE($9::int, (SELECT plan_id FROM adoptions WHERE id = $1)),
               $2, $3, $4, 'card', $5, $6, $7, $8)
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
 * CU-37 alta manual (y CU-38 A2): pago cobrado fuera de la web, por
 * transferencia, con el administrador que lo registra.
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
): Promise<number> {
  try {
    const { rows } = await db.query<{ id: number }>(
      `INSERT INTO payments (adoption_id, plan_id, amount, period_start, period_end, method, status,
                             payment_reference, paid_at, recorded_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'completed', $7, $8, $9)
       RETURNING id`,
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
    return (rows[0] as { id: number }).id;
  } catch (error) {
    // CU-38 A2a.
    if (esErrorPg(error, PG_UNIQUE_VIOLATION, 'payments_one_valid_per_period')) throw new PeriodAlreadyPaidError();
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

// ---------------------------------------------------------------------------
// CU-38: administración de pagos
// ---------------------------------------------------------------------------

/** Instante que cuenta como fecha del pago: el cobro o, si no se cobró, el intento. */
const FECHA = 'COALESCE(pa.paid_at, pa.created_at)';
const DIA = `(${FECHA} AT TIME ZONE '${ZONA_HORARIA_SANTUARIO}')::date`;

const FROM_ADMIN = `
    FROM payments pa
    JOIN adoptions ad ON ad.id = pa.adoption_id
    JOIN users u ON u.id = ad.user_id
    JOIN animals an ON an.id = ad.animal_id
    JOIN adoption_plans p ON p.id = pa.plan_id
    LEFT JOIN users r ON r.id = pa.recorded_by`;

const SELECT_ADMIN = `
  SELECT pa.id, pa.adoption_id, pa.amount, pa.period_start, pa.period_end, pa.method, pa.status,
         pa.payment_reference, pa.refunded_at, pa.failure_reason,
         ${FECHA} AS fecha, ${DIA}::text AS dia,
         (pa.refunded_at AT TIME ZONE '${ZONA_HORARIA_SANTUARIO}')::date::text AS dia_devolucion,
         u.id AS user_id, u.first_name, u.last_name, u.email, u.anonymized_at IS NOT NULL AS anonymized,
         an.id AS animal_id, an.name AS animal_name, p.id AS plan_id, p.name AS plan_name,
         r.id AS recorded_by_id, r.first_name || ' ' || r.last_name AS recorded_by_name
  ${FROM_ADMIN}`;

interface AdminPaymentRow {
  id: number;
  adoption_id: number;
  amount: string;
  period_start: string;
  period_end: string;
  method: PaymentMethod;
  status: PaymentStatus;
  payment_reference: string;
  refunded_at: Date | null;
  failure_reason: string | null;
  fecha: Date;
  dia: string;
  dia_devolucion: string | null;
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  anonymized: boolean;
  animal_id: number;
  animal_name: string;
  plan_id: number;
  plan_name: string;
  recorded_by_id: number | null;
  recorded_by_name: string | null;
}

/** Pago del panel, con el día del pago y de la devolución en la zona del santuario (para el CSV). */
export interface AdminPayment extends AdminPaymentListItemDto {
  day: string;
  refundDay: string | null;
}

function mapAdminRow(row: AdminPaymentRow): AdminPayment {
  return {
    id: row.id,
    adoptionId: row.adoption_id,
    // De una cuenta eliminada (CU-25) no se enseña el email anonimizado.
    adopter: {
      id: row.user_id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.anonymized ? '' : row.email,
    },
    animal: { id: row.animal_id, name: row.animal_name },
    plan: { id: row.plan_id, name: row.plan_name },
    amount: row.amount,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    method: row.method,
    status: row.status,
    reference: row.payment_reference,
    date: row.fecha.toISOString(),
    refundedAt: row.refunded_at?.toISOString() ?? null,
    failureReason: row.failure_reason,
    recordedBy: row.recorded_by_id === null ? null : { id: row.recorded_by_id, name: row.recorded_by_name ?? '' },
    day: row.dia,
    refundDay: row.dia_devolucion,
  };
}

export function toAdminListItem({ day: _day, refundDay: _refundDay, ...pago }: AdminPayment): AdminPaymentListItemDto {
  return pago;
}

export interface AdminPaymentFilters {
  q?: string;
  status?: PaymentStatus;
  method?: PaymentMethod;
  from?: string;
  to?: string;
  adoptionId?: number;
}

function filtroAdmin(filtros: AdminPaymentFilters): { where: string; params: unknown[] } {
  const params: unknown[] = [];
  const condiciones = ['TRUE'];
  const añadir = (sql: (n: string) => string, valor: unknown) => {
    params.push(valor);
    condiciones.push(sql(`$${params.length}`));
  };
  if (filtros.status !== undefined) añadir((n) => `pa.status = ${n}`, filtros.status);
  if (filtros.method !== undefined) añadir((n) => `pa.method = ${n}`, filtros.method);
  if (filtros.from !== undefined) añadir((n) => `${DIA} >= ${n}::date`, filtros.from);
  if (filtros.to !== undefined) añadir((n) => `${DIA} <= ${n}::date`, filtros.to);
  if (filtros.adoptionId !== undefined) añadir((n) => `pa.adoption_id = ${n}`, filtros.adoptionId);
  if (filtros.q !== undefined) {
    // Por adoptante (nombre o email) o por animal, como en CU-37.
    añadir(
      (n) =>
        `(${sinTildes("u.first_name || ' ' || u.last_name")} LIKE '%' || ${sinTildes(n)} || '%'
          OR lower(u.email) LIKE '%' || lower(${n}) || '%'
          OR ${sinTildes('an.name')} LIKE '%' || ${sinTildes(n)} || '%')`,
      escaparLike(filtros.q),
    );
  }
  return { where: condiciones.join(' AND '), params };
}

// Lista blanca de órdenes.
const ORDEN_ADMIN: Record<AdminPaymentSort, string> = {
  '-date': `${FECHA} DESC, pa.id DESC`,
  date: `${FECHA} ASC, pa.id ASC`,
  '-amount': 'pa.amount DESC, pa.id DESC',
  amount: 'pa.amount ASC, pa.id ASC',
};

/** Número de pagos y suma de lo cobrado (solo `completed`) con los filtros, calculada en SQL. */
export async function summaryForAdmin(
  db: Queryable,
  filtros: AdminPaymentFilters,
): Promise<{ total: number; collected: string }> {
  const { where, params } = filtroAdmin(filtros);
  const { rows } = await db.query<{ total: number; collected: string }>(
    `SELECT count(*)::int AS total,
            COALESCE(sum(pa.amount) FILTER (WHERE pa.status = 'completed'), 0)::numeric(12,2)::text AS collected
     ${FROM_ADMIN} WHERE ${where}`,
    params,
  );
  return rows[0] ?? { total: 0, collected: '0.00' };
}

/** Sin `limit`, todos los que cumplen los filtros (exportación CSV). */
export async function listForAdmin(
  db: Queryable,
  filtros: AdminPaymentFilters,
  opciones: { sort: AdminPaymentSort; limit?: number; offset?: number },
): Promise<AdminPayment[]> {
  const { where, params } = filtroAdmin(filtros);
  let pagina = '';
  if (opciones.limit !== undefined) {
    params.push(opciones.limit, opciones.offset ?? 0);
    pagina = `LIMIT $${params.length - 1} OFFSET $${params.length}`;
  }
  const { rows } = await db.query<AdminPaymentRow>(
    `${SELECT_ADMIN} WHERE ${where} ORDER BY ${ORDEN_ADMIN[opciones.sort]} ${pagina}`,
    params,
  );
  return rows.map(mapAdminRow);
}

export async function findForAdmin(db: Queryable, id: number): Promise<AdminPayment | null> {
  const { rows } = await db.query<AdminPaymentRow>(`${SELECT_ADMIN} WHERE pa.id = $1`, [id]);
  return rows[0] ? mapAdminRow(rows[0]) : null;
}

/** Pago que se va a devolver, bloqueado hasta el final de la transacción. */
export interface PaymentToRefund {
  id: number;
  adoptionId: number;
  status: PaymentStatus;
  method: PaymentMethod;
  reference: string;
}

export async function findForRefund(db: Queryable, id: number): Promise<PaymentToRefund | null> {
  const { rows } = await db.query<{
    id: number;
    adoption_id: number;
    status: PaymentStatus;
    method: PaymentMethod;
    payment_reference: string;
  }>('SELECT id, adoption_id, status, method, payment_reference FROM payments WHERE id = $1 FOR UPDATE', [id]);
  const row = rows[0];
  return row
    ? {
        id: row.id,
        adoptionId: row.adoption_id,
        status: row.status,
        method: row.method,
        reference: row.payment_reference,
      }
    : null;
}

/** Última cuota cobrada de la adopción (la que se devolvería al cancelarla). */
export async function findLastCompletedForAdoption(
  db: Queryable,
  adoptionId: number,
): Promise<{ id: number; amount: string } | null> {
  const { rows } = await db.query<{ id: number; amount: string }>(
    `SELECT id, amount FROM payments WHERE adoption_id = $1 AND status = 'completed'
      ORDER BY period_start DESC, id DESC LIMIT 1`,
    [adoptionId],
  );
  return rows[0] ?? null;
}

/** A1: el pago pasa a devuelto. Nunca se borra. */
export async function markRefunded(db: Queryable, id: number, ahora: Date): Promise<void> {
  await db.query("UPDATE payments SET status = 'refunded', refunded_at = $2 WHERE id = $1", [id, ahora]);
}
