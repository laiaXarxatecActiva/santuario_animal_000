import type {
  ContributionDonationDto,
  ContributionPaymentDto,
  ContributionsResponse,
  DonorTaxData,
  PaymentMethod,
  PaymentStatus,
} from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';
import { ZONA_HORARIA_SANTUARIO } from '../dominio/reloj.js';

// CU-19: cuotas y donaciones de un usuario. Todo filtra por el usuario: lo
// ajeno no existe para quien lo pide (404). Los totales se calculan en SQL.

/** Instante que cuenta para la fecha y el año: el cobro o, si no se cobró, la creación. */
const FECHA = (alias: string) => `COALESCE(${alias}.paid_at, ${alias}.created_at)`;
const ANIO = (alias: string) => `extract(year FROM ${FECHA(alias)} AT TIME ZONE '${ZONA_HORARIA_SANTUARIO}')::int`;

interface PaymentRow {
  id: number;
  adoption_id: number;
  animal_id: number;
  animal_name: string;
  amount: string;
  period_start: string;
  period_end: string;
  date: Date;
  status: PaymentStatus;
  method: PaymentMethod;
  payment_reference: string;
}

export function mapPaymentRow(row: PaymentRow): ContributionPaymentDto {
  return {
    id: row.id,
    adoptionId: row.adoption_id,
    animal: { id: row.animal_id, name: row.animal_name },
    amount: row.amount,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    date: row.date.toISOString(),
    status: row.status,
    method: row.method,
    reference: row.payment_reference,
  };
}

interface DonationRow {
  id: number;
  amount: string;
  date: Date;
  status: PaymentStatus;
  method: PaymentMethod;
  payment_reference: string;
  is_anonymous: boolean;
}

export function mapDonationRow(row: DonationRow): ContributionDonationDto {
  return {
    id: row.id,
    amount: row.amount,
    date: row.date.toISOString(),
    status: row.status,
    method: row.method,
    reference: row.payment_reference,
    isAnonymous: row.is_anonymous,
  };
}

export async function listPayments(db: Queryable, userId: number, year?: number): Promise<ContributionPaymentDto[]> {
  const { rows } = await db.query<PaymentRow>(
    `SELECT p.id, p.adoption_id, an.id AS animal_id, an.name AS animal_name, p.amount,
            p.period_start::text AS period_start, p.period_end::text AS period_end,
            ${FECHA('p')} AS date, p.status, p.method, p.payment_reference
       FROM payments p
       JOIN adoptions a ON a.id = p.adoption_id
       JOIN animals an ON an.id = a.animal_id
      WHERE a.user_id = $1 AND ($2::int IS NULL OR ${ANIO('p')} = $2)
      ORDER BY date DESC, p.id DESC`,
    [userId, year ?? null],
  );
  return rows.map(mapPaymentRow);
}

export async function listDonations(db: Queryable, userId: number, year?: number): Promise<ContributionDonationDto[]> {
  const { rows } = await db.query<DonationRow>(
    `SELECT d.id, d.amount, ${FECHA('d')} AS date, d.status, d.method, d.payment_reference, d.is_anonymous
       FROM donations d
      WHERE d.user_id = $1 AND ($2::int IS NULL OR ${ANIO('d')} = $2)
      ORDER BY date DESC, d.id DESC`,
    [userId, year ?? null],
  );
  return rows.map(mapDonationRow);
}

/** CU-19 paso 3: total cobrado por año (el más reciente primero) y desde el principio. */
export async function totals(db: Queryable, userId: number): Promise<ContributionsResponse['totals']> {
  const { rows } = await db.query<{ year: number; total: string; all_time: string }>(
    `WITH cobrado AS (
       SELECT ${ANIO('p')} AS year, p.amount
         FROM payments p JOIN adoptions a ON a.id = p.adoption_id
        WHERE a.user_id = $1 AND p.status = 'completed'
       UNION ALL
       SELECT ${ANIO('d')}, d.amount FROM donations d WHERE d.user_id = $1 AND d.status = 'completed'
     ), por_anio AS (
       SELECT year, sum(amount) AS total FROM cobrado GROUP BY year
     )
     SELECT year, total::numeric(12,2)::text AS total, (sum(total) OVER ())::numeric(12,2)::text AS all_time
       FROM por_anio ORDER BY year DESC`,
    [userId],
  );
  return {
    allTime: rows[0]?.all_time ?? '0.00',
    years: rows.map((r) => ({ year: r.year, total: r.total })),
  };
}

/** CU-05: datos fiscales de una donación, `NULL` si no pidió el certificado (y en las cuotas). */
export const COLUMNAS_FISCALES = `CASE WHEN tax_certificate THEN json_build_object(
    'taxId', donor_tax_id, 'address', donor_address, 'postalCode', donor_postal_code,
    'province', donor_province, 'country', donor_country) END AS fiscal`;

export interface ReceiptRow {
  id: number;
  payment_reference: string;
  amount: string;
  method: PaymentMethod;
  status: PaymentStatus;
  paid_at: Date | null;
  refunded_at: Date | null;
  animal_name: string | null;
  plan_name: string | null;
  period_start: string | null;
  period_end: string | null;
  fiscal: DonorTaxData | null;
}

export interface ReceiptRecord {
  id: number;
  reference: string;
  amount: string;
  method: PaymentMethod;
  status: PaymentStatus;
  paidAt: Date | null;
  refundedAt: Date | null;
  animalName: string | null;
  planName: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  fiscal: DonorTaxData | null;
}

export function mapReceiptRow(row: ReceiptRow): ReceiptRecord {
  return {
    id: row.id,
    reference: row.payment_reference,
    amount: row.amount,
    method: row.method,
    status: row.status,
    paidAt: row.paid_at,
    refundedAt: row.refunded_at,
    animalName: row.animal_name,
    planName: row.plan_name,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    fiscal: row.fiscal,
  };
}

/** Cuota propia para su recibo, con el plan con el que se cobró. */
export async function findOwnPaymentReceipt(db: Queryable, userId: number, id: number): Promise<ReceiptRecord | null> {
  const { rows } = await db.query<ReceiptRow>(
    `SELECT p.id, p.payment_reference, p.amount, p.method, p.status, p.paid_at, p.refunded_at,
            an.name AS animal_name,
            pl.name AS plan_name,
            p.period_start::text AS period_start, p.period_end::text AS period_end, NULL AS fiscal
       FROM payments p
       JOIN adoptions a ON a.id = p.adoption_id
       JOIN animals an ON an.id = a.animal_id
       JOIN adoption_plans pl ON pl.id = p.plan_id
      WHERE p.id = $2 AND a.user_id = $1`,
    [userId, id],
  );
  return rows[0] ? mapReceiptRow(rows[0]) : null;
}

export async function findOwnDonationReceipt(db: Queryable, userId: number, id: number): Promise<ReceiptRecord | null> {
  const { rows } = await db.query<ReceiptRow>(
    `SELECT id, payment_reference, amount, method, status, paid_at, refunded_at,
            NULL AS animal_name, NULL AS plan_name, NULL AS period_start, NULL AS period_end,
            ${COLUMNAS_FISCALES}
       FROM donations WHERE id = $2 AND user_id = $1`,
    [userId, id],
  );
  return rows[0] ? mapReceiptRow(rows[0]) : null;
}
