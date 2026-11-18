import type {
  AdminDonationListItemDto,
  AdminDonationSort,
  DonationResultDto,
  ManualPaymentMethod,
  PaymentMethod,
  PaymentStatus,
} from '@sanctuary/shared';
import { escaparLike, sinTildes } from '../db/busqueda.js';
import type { Queryable } from '../db/pool.js';
import { ZONA_HORARIA_SANTUARIO } from '../dominio/reloj.js';

// CU-05: donaciones. Nunca se borran; un reintento crea otra.

interface DonationRow {
  id: number;
  status: 'completed' | 'failed';
  amount: string;
  method: PaymentMethod;
  payment_reference: string;
  paid_at: Date | null;
  failure_reason: string | null;
  donor_name: string | null;
  donor_email: string | null;
  is_anonymous: boolean;
}

export function mapRow(row: DonationRow): DonationResultDto {
  return {
    id: row.id,
    status: row.status,
    amount: row.amount,
    method: row.method,
    reference: row.payment_reference,
    paidAt: row.paid_at?.toISOString() ?? null,
    failureReason: row.failure_reason,
    donorName: row.donor_name,
    donorEmail: row.donor_email,
    isAnonymous: row.is_anonymous,
  };
}

export interface NewDonation {
  userId: number | null;
  donorName: string | null;
  donorEmail: string | null;
  amount: string;
  isAnonymous: boolean;
  message: string | null;
  status: 'completed' | 'failed';
  reference: string;
  failureReason: string | null;
  paidAt: Date | null;
}

/** Donación de la pasarela simulada, con el resultado del cobro. */
export async function create(db: Queryable, d: NewDonation): Promise<DonationResultDto> {
  const { rows } = await db.query<DonationRow>(
    `INSERT INTO donations (user_id, donor_name, donor_email, amount, is_anonymous, message,
                            method, status, payment_reference, failure_reason, paid_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'simulated', $7, $8, $9, $10)
     RETURNING id, status, amount, method, payment_reference, paid_at, failure_reason,
               donor_name, donor_email, is_anonymous`,
    [
      d.userId,
      d.donorName,
      d.donorEmail,
      d.amount,
      d.isAnonymous,
      d.message,
      d.status,
      d.reference,
      d.failureReason,
      d.paidAt,
    ],
  );
  return mapRow(rows[0] as DonationRow);
}

/** CU-25 4.3: las donaciones del usuario se quedan sin nombre ni email; los importes se conservan. */
export async function clearDonorData(db: Queryable, userId: number): Promise<void> {
  await db.query('UPDATE donations SET donor_name = NULL, donor_email = NULL WHERE user_id = $1', [userId]);
}

// ---------------------------------------------------------------------------
// CU-39: administración de donaciones
// ---------------------------------------------------------------------------

/** Instante que cuenta como fecha: el cobro o, si no se cobró, el intento. */
const FECHA = 'COALESCE(d.paid_at, d.created_at)';
const DIA = `(${FECHA} AT TIME ZONE '${ZONA_HORARIA_SANTUARIO}')::date`;

const SELECT_ADMIN = `
  SELECT d.id, d.user_id, d.donor_name, d.donor_email, d.amount, d.is_anonymous, d.message, d.method, d.status,
         d.payment_reference, d.refunded_at, d.failure_reason,
         ${FECHA} AS fecha, ${DIA}::text AS dia,
         (d.refunded_at AT TIME ZONE '${ZONA_HORARIA_SANTUARIO}')::date::text AS dia_devolucion,
         (u.anonymized_at IS NOT NULL) AS anonymized,
         r.id AS recorded_by_id, r.first_name || ' ' || r.last_name AS recorded_by_name
    FROM donations d
    LEFT JOIN users u ON u.id = d.user_id
    LEFT JOIN users r ON r.id = d.recorded_by`;

interface AdminDonationRow {
  id: number;
  user_id: number | null;
  donor_name: string | null;
  donor_email: string | null;
  amount: string;
  is_anonymous: boolean;
  message: string | null;
  method: PaymentMethod;
  status: PaymentStatus;
  payment_reference: string;
  refunded_at: Date | null;
  failure_reason: string | null;
  fecha: Date;
  dia: string;
  dia_devolucion: string | null;
  anonymized: boolean | null;
  recorded_by_id: number | null;
  recorded_by_name: string | null;
}

/** Donación del panel, con el día del cobro y de la devolución en la zona del santuario (para el CSV). */
export interface AdminDonation extends AdminDonationListItemDto {
  day: string;
  refundDay: string | null;
  /** La cuenta que la hizo se eliminó (CU-25): no se le avisa en la campana. */
  accountDeleted: boolean;
}

function mapAdminRow(row: AdminDonationRow): AdminDonation {
  return {
    id: row.id,
    userId: row.user_id,
    donorName: row.donor_name,
    donorEmail: row.donor_email,
    isAnonymous: row.is_anonymous,
    amount: row.amount,
    message: row.message,
    method: row.method,
    status: row.status,
    reference: row.payment_reference,
    date: row.fecha.toISOString(),
    refundedAt: row.refunded_at?.toISOString() ?? null,
    failureReason: row.failure_reason,
    recordedBy: row.recorded_by_id === null ? null : { id: row.recorded_by_id, name: row.recorded_by_name ?? '' },
    day: row.dia,
    refundDay: row.dia_devolucion,
    accountDeleted: row.anonymized === true,
  };
}

export function toAdminListItem({
  day: _day,
  refundDay: _refundDay,
  accountDeleted: _accountDeleted,
  ...donacion
}: AdminDonation): AdminDonationListItemDto {
  return donacion;
}

export interface AdminDonationFilters {
  q?: string;
  status?: PaymentStatus;
  method?: PaymentMethod;
  from?: string;
  to?: string;
}

function filtroAdmin(filtros: AdminDonationFilters, params: unknown[] = []): { where: string; params: unknown[] } {
  const condiciones = ['TRUE'];
  const añadir = (sql: (n: string) => string, valor: unknown) => {
    params.push(valor);
    condiciones.push(sql(`$${params.length}`));
  };
  if (filtros.status !== undefined) añadir((n) => `d.status = ${n}`, filtros.status);
  if (filtros.method !== undefined) añadir((n) => `d.method = ${n}`, filtros.method);
  if (filtros.from !== undefined) añadir((n) => `${DIA} >= ${n}::date`, filtros.from);
  if (filtros.to !== undefined) añadir((n) => `${DIA} <= ${n}::date`, filtros.to);
  if (filtros.q !== undefined) {
    // Por el nombre o el email del donante.
    añadir(
      (n) =>
        `(${sinTildes("COALESCE(d.donor_name, '')")} LIKE '%' || ${sinTildes(n)} || '%'
          OR lower(COALESCE(d.donor_email, '')) LIKE '%' || lower(${n}) || '%')`,
      escaparLike(filtros.q),
    );
  }
  return { where: condiciones.join(' AND '), params };
}

// Lista blanca de órdenes.
const ORDEN_ADMIN: Record<AdminDonationSort, string> = {
  '-date': `${FECHA} DESC, d.id DESC`,
  date: `${FECHA} ASC, d.id ASC`,
  '-amount': 'd.amount DESC, d.id DESC',
  amount: 'd.amount ASC, d.id ASC',
};

/** Número de donaciones y suma de lo cobrado (solo `completed`) con los filtros, en SQL. */
export async function summaryForAdmin(
  db: Queryable,
  filtros: AdminDonationFilters,
): Promise<{ total: number; collected: string }> {
  const { where, params } = filtroAdmin(filtros);
  const { rows } = await db.query<{ total: number; collected: string }>(
    `SELECT count(*)::int AS total,
            COALESCE(sum(d.amount) FILTER (WHERE d.status = 'completed'), 0)::numeric(12,2)::text AS collected
       FROM donations d WHERE ${where}`,
    params,
  );
  return rows[0] ?? { total: 0, collected: '0.00' };
}

/** Sin `limit`, todas las que cumplen los filtros (exportación CSV). */
export async function listForAdmin(
  db: Queryable,
  filtros: AdminDonationFilters,
  opciones: { sort: AdminDonationSort; limit?: number; offset?: number },
): Promise<AdminDonation[]> {
  const { where, params } = filtroAdmin(filtros);
  let pagina = '';
  if (opciones.limit !== undefined) {
    params.push(opciones.limit, opciones.offset ?? 0);
    pagina = `LIMIT $${params.length - 1} OFFSET $${params.length}`;
  }
  const { rows } = await db.query<AdminDonationRow>(
    `${SELECT_ADMIN} WHERE ${where} ORDER BY ${ORDEN_ADMIN[opciones.sort]} ${pagina}`,
    params,
  );
  return rows.map(mapAdminRow);
}

export async function findForAdmin(db: Queryable, id: number): Promise<AdminDonation | null> {
  const { rows } = await db.query<AdminDonationRow>(`${SELECT_ADMIN} WHERE d.id = $1`, [id]);
  return rows[0] ? mapAdminRow(rows[0]) : null;
}

/**
 * Paso 3: lo cobrado en cada mes entre `desde` y `hasta` (primeros días de mes),
 * con los meses sin donaciones a 0.
 */
export async function monthlyTotalsForAdmin(
  db: Queryable,
  filtros: Omit<AdminDonationFilters, 'status'>,
  rango: { desde: string; hasta: string },
): Promise<{ month: string; total: string; count: number }[]> {
  const { where, params } = filtroAdmin({ ...filtros, status: 'completed' }, [rango.desde, rango.hasta]);
  const { rows } = await db.query<{ month: string; total: string; count: number }>(
    `WITH meses AS (
       SELECT generate_series($1::date, $2::date, interval '1 month')::date AS mes
     ), cobradas AS (
       SELECT date_trunc('month', ${DIA})::date AS mes, d.amount FROM donations d WHERE ${where}
     )
     SELECT to_char(m.mes, 'YYYY-MM') AS month,
            COALESCE(sum(c.amount), 0)::numeric(12,2)::text AS total,
            count(c.amount)::int AS count
       FROM meses m LEFT JOIN cobradas c ON c.mes = m.mes
      GROUP BY m.mes ORDER BY m.mes`,
    params,
  );
  return rows;
}

/** Donación que se va a devolver, bloqueada hasta el final de la transacción. */
export async function findForRefund(
  db: Queryable,
  id: number,
): Promise<{ id: number; status: PaymentStatus; method: PaymentMethod; reference: string } | null> {
  const { rows } = await db.query<{ id: number; status: PaymentStatus; method: PaymentMethod; reference: string }>(
    'SELECT id, status, method, payment_reference AS reference FROM donations WHERE id = $1 FOR UPDATE',
    [id],
  );
  return rows[0] ?? null;
}

/** A2: la donación pasa a devuelta. Nunca se borra. */
export async function markRefunded(db: Queryable, id: number, ahora: Date): Promise<void> {
  await db.query("UPDATE donations SET status = 'refunded', refunded_at = $2 WHERE id = $1", [id, ahora]);
}

export interface NewManualDonation {
  donorName: string | null;
  donorEmail: string | null;
  amount: string;
  isAnonymous: boolean;
  message: string | null;
  method: ManualPaymentMethod;
  reference: string;
  /** Día del cobro. Si es hoy, se guarda `ahora`; si es anterior, el mediodía de ese día. */
  day: string;
  ahora: Date;
  hoy: string;
  recordedBy: number;
}

/** A1: donación cobrada fuera de la web, sin cuenta vinculada. */
export async function createManual(db: Queryable, d: NewManualDonation): Promise<number> {
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO donations (donor_name, donor_email, amount, is_anonymous, message,
                            method, status, payment_reference, paid_at, recorded_by)
     VALUES ($1, $2, $3, $4, $5, $6, 'completed', $7,
             CASE WHEN $8::date = $9::date THEN $10::timestamptz
                  ELSE ($8::date + time '12:00') AT TIME ZONE '${ZONA_HORARIA_SANTUARIO}' END,
             $11)
     RETURNING id`,
    [
      d.donorName,
      d.donorEmail,
      d.amount,
      d.isAnonymous,
      d.message,
      d.method,
      d.reference,
      d.day,
      d.hoy,
      d.ahora,
      d.recordedBy,
    ],
  );
  return (rows[0] as { id: number }).id;
}
