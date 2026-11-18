import type {
  AdminAdoptionListItemDto,
  AdminAdoptionSort,
  AdminPersonRef,
  AdoptionEndReason,
  AdoptionStatus,
  EmailFrequency,
  PhotoDto,
} from '@sanctuary/shared';
import { escaparLike, sinTildes } from '../db/busqueda.js';
import type { Queryable } from '../db/pool.js';
import { esErrorPg, PG_CHECK_VIOLATION, PG_UNIQUE_VIOLATION } from '../db/pg-errors.js';
import { ZONA_HORARIA_SANTUARIO } from '../dominio/reloj.js';
import { AdoptionAlreadyOpenError, WorkerCannotAdoptError } from '../errors/app-error.js';
import { COLUMNAS_PORTADA, JOIN_PORTADA, mapCover, type CoverRow } from './photo.model.js';

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

interface AdoptionRow extends CoverRow {
  id: number;
  user_id: number;
  status: AdoptionStatus;
  animal_id: number;
  animal_name: string;
  species_name: string;
  plan_id: number;
  plan_name: string;
  monthly_amount: string;
  next_plan_id: number | null;
  next_plan_name: string | null;
  next_plan_monthly_amount: string | null;
  start_date: string | null;
  end_date: string | null;
  next_billing_date: string | null;
  cancel_requested_at: Date | null;
  end_reason: AdoptionEndReason | null;
  last_update_date: string | null;
  created_at: Date;
}

interface PlanSummary {
  id: number;
  name: string;
  monthlyAmount: string;
}

/** Adopción con su animal, su plan y la fecha de la última actualización del animal. */
export interface Adoption {
  id: number;
  userId: number;
  status: AdoptionStatus;
  animal: { id: number; name: string; species: string; coverPhoto: PhotoDto | null };
  plan: PlanSummary;
  nextPlan: PlanSummary | null;
  startDate: string | null;
  endDate: string | null;
  nextBillingDate: string | null;
  cancelRequestedAt: Date | null;
  endReason: AdoptionEndReason | null;
  /** Día (en la zona del santuario) de la última actualización del animal. */
  lastUpdateDate: string | null;
  createdAt: Date;
}

export function mapRow(row: AdoptionRow): Adoption {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    animal: { id: row.animal_id, name: row.animal_name, species: row.species_name, coverPhoto: mapCover(row) },
    plan: { id: row.plan_id, name: row.plan_name, monthlyAmount: row.monthly_amount },
    nextPlan:
      row.next_plan_id === null
        ? null
        : { id: row.next_plan_id, name: row.next_plan_name ?? '', monthlyAmount: row.next_plan_monthly_amount ?? '' },
    startDate: row.start_date,
    endDate: row.end_date,
    nextBillingDate: row.next_billing_date,
    cancelRequestedAt: row.cancel_requested_at,
    endReason: row.end_reason,
    lastUpdateDate: row.last_update_date,
    createdAt: row.created_at,
  };
}

const SELECT_ADOPCION = `
  SELECT ad.id, ad.user_id, ad.status, ad.start_date, ad.end_date, ad.next_billing_date,
         ad.cancel_requested_at, ad.end_reason, ad.created_at,
         an.id AS animal_id, an.name AS animal_name, s.name AS species_name,
         ${COLUMNAS_PORTADA},
         p.id AS plan_id, p.name AS plan_name, p.monthly_amount,
         np.id AS next_plan_id, np.name AS next_plan_name, np.monthly_amount AS next_plan_monthly_amount,
         (SELECT (max(u.published_at) AT TIME ZONE '${ZONA_HORARIA_SANTUARIO}')::date
            FROM animal_updates u
           WHERE u.animal_id = an.id) AS last_update_date
    FROM adoptions ad
    JOIN animals an ON an.id = ad.animal_id
    JOIN species s ON s.id = an.species_id
    ${JOIN_PORTADA('an')}
    JOIN adoption_plans p ON p.id = ad.plan_id
    LEFT JOIN adoption_plans np ON np.id = ad.next_plan_id`;

const ABIERTA = "ad.status IN ('pending', 'active', 'paused')";

export async function findOpenByUserAndAnimal(
  db: Queryable,
  userId: number,
  animalId: number,
): Promise<Adoption | null> {
  const { rows } = await db.query<AdoptionRow>(
    `${SELECT_ADOPCION} WHERE ad.user_id = $1 AND ad.animal_id = $2 AND ${ABIERTA}`,
    [userId, animalId],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

/** RN-15: el usuario tiene una adopción activa del animal. */
export async function hasActive(db: Queryable, userId: number, animalId: number): Promise<boolean> {
  const { rowCount } = await db.query(
    "SELECT 1 FROM adoptions WHERE user_id = $1 AND animal_id = $2 AND status = 'active'",
    [userId, animalId],
  );
  return rowCount === 1;
}

/** Solo si es del usuario: una adopción ajena es `null` (404, no 403). */
export async function findOwnedById(db: Queryable, userId: number, id: number): Promise<Adoption | null> {
  const { rows } = await db.query<AdoptionRow>(`${SELECT_ADOPCION} WHERE ad.id = $1 AND ad.user_id = $2`, [id, userId]);
  return rows[0] ? mapRow(rows[0]) : null;
}

/** Adopciones del usuario, las más recientes primero. */
export async function listByUser(
  db: Queryable,
  userId: number,
  filtro: { animalId?: number } = {},
): Promise<Adoption[]> {
  const { rows } = await db.query<AdoptionRow>(
    `${SELECT_ADOPCION}
      WHERE ad.user_id = $1 AND ($2::int IS NULL OR ad.animal_id = $2)
      ORDER BY ad.created_at DESC, ad.id DESC`,
    [userId, filtro.animalId ?? null],
  );
  return rows.map(mapRow);
}

/**
 * CU-13 paso 5: crea la adopción pendiente. La base de datos impide dos
 * adopciones abiertas del mismo animal (RN-05) y que adopte un trabajador (RN-03).
 */
export async function create(
  db: Queryable,
  datos: { userId: number; animalId: number; planId: number },
): Promise<Adoption> {
  let id: number;
  try {
    const { rows } = await db.query<{ id: number }>(
      "INSERT INTO adoptions (user_id, animal_id, plan_id, status) VALUES ($1, $2, $3, 'pending') RETURNING id",
      [datos.userId, datos.animalId, datos.planId],
    );
    id = (rows[0] as { id: number }).id;
  } catch (error) {
    if (esErrorPg(error, PG_UNIQUE_VIOLATION, 'adoptions_one_open_per_user_animal'))
      throw new AdoptionAlreadyOpenError();
    if (esErrorPg(error, PG_CHECK_VIOLATION) && error instanceof Error && error.message.includes('rol adopter')) {
      throw new WorkerCannotAdoptError();
    }
    throw error;
  }
  return (await findOwnedById(db, datos.userId, id)) as Adoption;
}

/** Primer pago (pendiente) o regularización (pausada): pasa a `active`. Conserva el inicio si ya lo tenía. */
export async function activate(
  db: Queryable,
  id: number,
  fechas: { startDate: string; nextBillingDate: string },
): Promise<void> {
  await db.query(
    `UPDATE adoptions
        SET status = 'active', start_date = COALESCE(start_date, $2), next_billing_date = $3
      WHERE id = $1`,
    [id, fechas.startDate, fechas.nextBillingDate],
  );
}

/**
 * CU-33 5.2 (también CU-28 A3): cierra las adopciones abiertas de un animal.
 * Las activas y pausadas pasan a `finished` y las pendientes a `cancelled`.
 * `end_date` nunca queda antes del inicio (`adoptions_dates_order`).
 */
export async function closeOpenForAnimal(
  db: Queryable,
  animalId: number,
  cierre: { reason: AdoptionEndReason; date: string },
): Promise<number[]> {
  const { rows } = await db.query<{ user_id: number }>(
    `UPDATE adoptions
        SET status = CASE WHEN status = 'pending' THEN 'cancelled' ELSE 'finished' END,
            end_reason = $2,
            end_date = GREATEST($3::date, COALESCE(start_date, $3::date)),
            next_billing_date = NULL,
            next_plan_id = NULL
      WHERE animal_id = $1 AND status IN ('pending', 'active', 'paused')
      RETURNING user_id`,
    [animalId, cierre.reason, cierre.date],
  );
  return [...new Set(rows.map((r) => r.user_id))];
}

/** Adoptante a quien se avisa (CU-31, CU-33), con sus preferencias de email. */
export interface AdoptanteAvisable {
  userId: number;
  firstName: string;
  email: string;
  emailNotifications: boolean;
  emailFrequency: EmailFrequency;
}

/** CU-31 paso 4: adoptantes con adopción activa del animal (una fila por persona). */
export async function listActiveAdopters(db: Queryable, animalId: number): Promise<AdoptanteAvisable[]> {
  const { rows } = await db.query<{
    id: number;
    first_name: string;
    email: string;
    email_notifications: boolean;
    email_frequency: EmailFrequency;
  }>(
    `SELECT DISTINCT u.id, u.first_name, u.email, u.email_notifications, u.email_frequency
       FROM adoptions ad JOIN users u ON u.id = ad.user_id
      WHERE ad.animal_id = $1 AND ad.status = 'active'
      ORDER BY u.id`,
    [animalId],
  );
  return rows.map((r) => ({
    userId: r.id,
    firstName: r.first_name,
    email: r.email,
    emailNotifications: r.email_notifications,
    emailFrequency: r.email_frequency,
  }));
}

/** CU-43: ids de las adopciones con la cuota vencida, para procesarlas una a una. */
export async function listDueForBilling(db: Queryable, hoy: string): Promise<number[]> {
  const { rows } = await db.query<{ id: number }>(
    `SELECT id FROM adoptions
      WHERE status = 'active' AND cancel_requested_at IS NULL AND next_billing_date <= $1
      ORDER BY next_billing_date, id`,
    [hoy],
  );
  return rows.map((r) => r.id);
}

/** CU-35 4a: ids de las adopciones abiertas de un usuario, bloqueadas hasta el final de la transacción. */
export async function listOpenIdsForUpdate(db: Queryable, userId: number): Promise<number[]> {
  const { rows } = await db.query<{ id: number }>(
    `SELECT id FROM adoptions WHERE user_id = $1 AND status IN ('pending', 'active', 'paused') ORDER BY id FOR UPDATE`,
    [userId],
  );
  return rows.map((r) => r.id);
}

/** Lee la adopción bloqueando su fila hasta el final de la transacción (cobros). */
export async function findByIdForUpdate(db: Queryable, id: number): Promise<Adoption | null> {
  const { rows } = await db.query<AdoptionRow>(`${SELECT_ADOPCION} WHERE ad.id = $1 FOR UPDATE OF ad`, [id]);
  return rows[0] ? mapRow(rows[0]) : null;
}

/** CU-43 paso 1 (CU-20): el plan programado pasa a ser el actual. */
export async function applyNextPlan(db: Queryable, id: number): Promise<void> {
  await db.query(
    'UPDATE adoptions SET plan_id = next_plan_id, next_plan_id = NULL WHERE id = $1 AND next_plan_id IS NOT NULL',
    [id],
  );
}

export async function setNextBillingDate(db: Queryable, id: number, fecha: string): Promise<void> {
  await db.query('UPDATE adoptions SET next_billing_date = $2 WHERE id = $1', [id, fecha]);
}

/** CU-43 3a: cuota fallida. `next_billing_date` se conserva: es la cuota pendiente de regularizar. */
export async function pause(db: Queryable, id: number): Promise<void> {
  await db.query("UPDATE adoptions SET status = 'paused' WHERE id = $1 AND status = 'active'", [id]);
}

export interface ClosedAdoption {
  id: number;
  userId: number;
  animalId: number;
  animalName: string;
}

/** CU-44: cancela las pendientes creadas antes de `limite` (RN-07). */
export async function cancelExpiredPending(db: Queryable, limite: Date, hoy: string): Promise<ClosedAdoption[]> {
  const { rows } = await db.query<{ id: number; user_id: number; animal_id: number; animal_name: string }>(
    `UPDATE adoptions ad
        SET status = 'cancelled', end_reason = 'payment_not_completed', end_date = $2
       FROM animals an
      WHERE an.id = ad.animal_id AND ad.status = 'pending' AND ad.created_at < $1
     RETURNING ad.id, ad.user_id, ad.animal_id, an.name AS animal_name`,
    [limite, hoy],
  );
  return rows.map((r) => ({ id: r.id, userId: r.user_id, animalId: r.animal_id, animalName: r.animal_name }));
}

/** CU-45: las bajas cuyo último día pagado ya ha pasado terminan (RN-10). */
export async function finishCancelled(db: Queryable, hoy: string): Promise<ClosedAdoption[]> {
  const { rows } = await db.query<{ id: number; user_id: number; animal_id: number; animal_name: string }>(
    `UPDATE adoptions ad
        SET status = 'finished', end_reason = 'user_cancelled'
       FROM animals an
      WHERE an.id = ad.animal_id AND ad.status = 'active'
        AND ad.cancel_requested_at IS NOT NULL AND ad.end_date < $1
     RETURNING ad.id, ad.user_id, ad.animal_id, an.name AS animal_name`,
    [hoy],
  );
  return rows.map((r) => ({ id: r.id, userId: r.user_id, animalId: r.animal_id, animalName: r.animal_name }));
}

/** CU-20: plan de la próxima cuota (`null` anula el cambio programado). */
export async function setNextPlan(db: Queryable, id: number, nextPlanId: number | null): Promise<void> {
  await db.query('UPDATE adoptions SET next_plan_id = $2 WHERE id = $1', [id, nextPlanId]);
}

/** CU-21: guarda la baja. Ya no se cobra más ni se aplica ningún cambio de plan. */
export async function applyCancellation(
  db: Queryable,
  id: number,
  baja: { status: AdoptionStatus; endReason: AdoptionEndReason | null; endDate: string; requestedAt: Date },
): Promise<void> {
  await db.query(
    `UPDATE adoptions
        SET status = $2, end_reason = $3, end_date = $4, cancel_requested_at = $5,
            next_billing_date = NULL, next_plan_id = NULL
      WHERE id = $1`,
    [id, baja.status, baja.endReason, baja.endDate, baja.requestedAt],
  );
}

/**
 * CU-25 4.1: las abiertas del usuario se cierran con `account_deleted`: las
 * pendientes se cancelan y las activas y pausadas terminan hoy, sin más cobros.
 */
export async function closeOpenForUser(db: Queryable, userId: number, hoy: string): Promise<void> {
  await db.query(
    `UPDATE adoptions
        SET status = CASE WHEN status = 'pending' THEN 'cancelled' ELSE 'finished' END,
            end_reason = 'account_deleted',
            end_date = GREATEST($2::date, COALESCE(start_date, $2::date)),
            next_billing_date = NULL,
            next_plan_id = NULL
      WHERE user_id = $1 AND status IN ('pending', 'active', 'paused')`,
    [userId, hoy],
  );
}

// ---------------------------------------------------------------------------
// CU-37: administración de adopciones
// ---------------------------------------------------------------------------

interface AdminAdoptionRow {
  id: number;
  status: AdoptionStatus;
  start_date: string | null;
  end_date: string | null;
  next_billing_date: string | null;
  cancel_requested_at: Date | null;
  end_reason: AdoptionEndReason | null;
  created_at: Date;
  notes: string | null;
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  animal_id: number;
  animal_name: string;
  plan_id: number;
  plan_name: string;
  monthly_amount: string;
  next_plan_id: number | null;
  next_plan_name: string | null;
  next_plan_monthly_amount: string | null;
  created_by_id: number | null;
  created_by_name: string | null;
}

/** Adopción vista desde el panel: la fila del listado y los datos de la ficha. */
export interface AdminAdoption extends AdminAdoptionListItemDto {
  nextPlan: { id: number; name: string; monthlyAmount: string } | null;
  endReason: AdoptionEndReason | null;
  notes: string | null;
  createdBy: AdminPersonRef | null;
}

function mapAdminRow(row: AdminAdoptionRow): AdminAdoption {
  return {
    id: row.id,
    adopter: { id: row.user_id, firstName: row.first_name, lastName: row.last_name, email: row.email },
    animal: { id: row.animal_id, name: row.animal_name },
    plan: { id: row.plan_id, name: row.plan_name, monthlyAmount: row.monthly_amount },
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    nextBillingDate: row.next_billing_date,
    cancelRequested: row.cancel_requested_at !== null,
    createdAt: row.created_at.toISOString(),
    nextPlan:
      row.next_plan_id === null
        ? null
        : { id: row.next_plan_id, name: row.next_plan_name ?? '', monthlyAmount: row.next_plan_monthly_amount ?? '' },
    endReason: row.end_reason,
    notes: row.notes,
    createdBy: row.created_by_id === null ? null : { id: row.created_by_id, name: row.created_by_name ?? '' },
  };
}

/** Solo la lista de un listado (sin las notas ni el plan programado). */
export function toAdminListItem(adopcion: AdminAdoption): AdminAdoptionListItemDto {
  return {
    id: adopcion.id,
    adopter: adopcion.adopter,
    animal: adopcion.animal,
    plan: adopcion.plan,
    status: adopcion.status,
    startDate: adopcion.startDate,
    endDate: adopcion.endDate,
    nextBillingDate: adopcion.nextBillingDate,
    cancelRequested: adopcion.cancelRequested,
    createdAt: adopcion.createdAt,
  };
}

const FROM_ADMIN = `
    FROM adoptions ad
    JOIN users u ON u.id = ad.user_id
    JOIN animals an ON an.id = ad.animal_id
    JOIN adoption_plans p ON p.id = ad.plan_id
    LEFT JOIN adoption_plans np ON np.id = ad.next_plan_id
    LEFT JOIN users cb ON cb.id = ad.created_by`;

const SELECT_ADMIN = `
  SELECT ad.id, ad.status, ad.start_date, ad.end_date, ad.next_billing_date, ad.cancel_requested_at,
         ad.end_reason, ad.created_at, ad.notes,
         u.id AS user_id, u.first_name, u.last_name, u.email,
         an.id AS animal_id, an.name AS animal_name,
         p.id AS plan_id, p.name AS plan_name, p.monthly_amount,
         np.id AS next_plan_id, np.name AS next_plan_name, np.monthly_amount AS next_plan_monthly_amount,
         cb.id AS created_by_id, cb.first_name || ' ' || cb.last_name AS created_by_name
  ${FROM_ADMIN}`;

export interface AdminAdoptionFilters {
  q?: string;
  status?: AdoptionStatus;
  planId?: number;
  animalId?: number;
  userId?: number;
}

function filtroAdmin(filtros: AdminAdoptionFilters): { where: string; params: unknown[] } {
  const params: unknown[] = [];
  const condiciones = ['TRUE'];
  const añadir = (sql: (n: string) => string, valor: unknown) => {
    params.push(valor);
    condiciones.push(sql(`$${params.length}`));
  };
  if (filtros.status !== undefined) añadir((n) => `ad.status = ${n}`, filtros.status);
  if (filtros.planId !== undefined) añadir((n) => `ad.plan_id = ${n}`, filtros.planId);
  if (filtros.animalId !== undefined) añadir((n) => `ad.animal_id = ${n}`, filtros.animalId);
  if (filtros.userId !== undefined) añadir((n) => `ad.user_id = ${n}`, filtros.userId);
  if (filtros.q !== undefined) {
    // Por adoptante (nombre o email) o por animal.
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
const ORDEN_ADMIN: Record<AdminAdoptionSort, string> = {
  '-createdAt': 'ad.created_at DESC, ad.id DESC',
  createdAt: 'ad.created_at ASC, ad.id ASC',
  '-startDate': 'ad.start_date DESC NULLS LAST, ad.id DESC',
  startDate: 'ad.start_date ASC NULLS LAST, ad.id ASC',
  nextBillingDate: 'ad.next_billing_date ASC NULLS LAST, ad.id ASC',
  '-nextBillingDate': 'ad.next_billing_date DESC NULLS LAST, ad.id DESC',
};

export async function countForAdmin(db: Queryable, filtros: AdminAdoptionFilters): Promise<number> {
  const { where, params } = filtroAdmin(filtros);
  const { rows } = await db.query<{ total: number }>(
    `SELECT count(*)::int AS total ${FROM_ADMIN} WHERE ${where}`,
    params,
  );
  return rows[0]?.total ?? 0;
}

export async function listForAdmin(
  db: Queryable,
  filtros: AdminAdoptionFilters,
  opciones: { sort: AdminAdoptionSort; limit: number; offset: number },
): Promise<AdminAdoption[]> {
  const { where, params } = filtroAdmin(filtros);
  params.push(opciones.limit, opciones.offset);
  const { rows } = await db.query<AdminAdoptionRow>(
    `${SELECT_ADMIN} WHERE ${where} ORDER BY ${ORDEN_ADMIN[opciones.sort]}
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows.map(mapAdminRow);
}

/** Con `forUpdate`, bloquea la fila de la adopción hasta el final de la transacción. */
export async function findForAdmin(db: Queryable, id: number, forUpdate = false): Promise<AdminAdoption | null> {
  const { rows } = await db.query<AdminAdoptionRow>(
    `${SELECT_ADMIN} WHERE ad.id = $1${forUpdate ? ' FOR UPDATE OF ad' : ''}`,
    [id],
  );
  return rows[0] ? mapAdminRow(rows[0]) : null;
}

/**
 * CU-37 alta manual, paso 3: la adopción nace activa (el primer pago se cobró
 * fuera de la web). La base de datos impide dos abiertas del mismo animal (RN-05)
 * y que adopte un trabajador (RN-03).
 */
export async function createManual(
  db: Queryable,
  datos: {
    userId: number;
    animalId: number;
    planId: number;
    startDate: string;
    nextBillingDate: string;
    createdBy: number;
    notes: string | null;
  },
): Promise<number> {
  try {
    const { rows } = await db.query<{ id: number }>(
      `INSERT INTO adoptions (user_id, animal_id, plan_id, status, start_date, next_billing_date, created_by, notes)
       VALUES ($1, $2, $3, 'active', $4, $5, $6, $7)
       RETURNING id`,
      [
        datos.userId,
        datos.animalId,
        datos.planId,
        datos.startDate,
        datos.nextBillingDate,
        datos.createdBy,
        datos.notes,
      ],
    );
    return (rows[0] as { id: number }).id;
  } catch (error) {
    if (esErrorPg(error, PG_UNIQUE_VIOLATION, 'adoptions_one_open_per_user_animal'))
      throw new AdoptionAlreadyOpenError();
    if (esErrorPg(error, PG_CHECK_VIOLATION) && error instanceof Error && error.message.includes('rol adopter')) {
      throw new WorkerCannotAdoptError();
    }
    throw error;
  }
}

/** CU-37 A2: la pausada vuelve a activa; `next_billing_date` se conserva (CU-43 la cobrará). */
export async function resume(db: Queryable, id: number): Promise<void> {
  await db.query("UPDATE adoptions SET status = 'active' WHERE id = $1 AND status = 'paused'", [id]);
}

/** CU-37 A3: cierre por el administrador. Ya no se cobra más ni se aplica ningún cambio de plan. */
export async function closeByAdmin(
  db: Queryable,
  id: number,
  cierre: { status: AdoptionStatus; endReason: AdoptionEndReason; endDate: string },
): Promise<void> {
  await db.query(
    `UPDATE adoptions
        SET status = $2, end_reason = $3, end_date = $4, next_billing_date = NULL, next_plan_id = NULL
      WHERE id = $1`,
    [id, cierre.status, cierre.endReason, cierre.endDate],
  );
}

/** Notas internas del administrador (se guardan enteras; el dominio añade cada entrada). */
export async function setNotes(db: Queryable, id: number, notes: string): Promise<void> {
  await db.query('UPDATE adoptions SET notes = $2 WHERE id = $1', [id, notes]);
}
