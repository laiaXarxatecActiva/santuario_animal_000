import type { AdoptionEndReason, AdoptionStatus, PhotoDto } from '@sanctuary/shared';
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
