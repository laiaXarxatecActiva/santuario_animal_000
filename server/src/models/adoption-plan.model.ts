import type { AdminPlanDto, AdoptionPlanDto } from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';
import { esErrorPg, PG_FOREIGN_KEY_VIOLATION, PG_RESTRICT_VIOLATION, PG_UNIQUE_VIOLATION } from '../db/pg-errors.js';
import { comprobarBorradoPlan } from '../dominio/planes.js';
import { PlanAlreadyExistsError, PlanHasHistoryError } from '../errors/app-error.js';

interface AdoptionPlanRow {
  id: number;
  name: string;
  monthly_amount: string;
  description: string | null;
  is_default: boolean;
}

export function mapRow(row: AdoptionPlanRow): AdoptionPlanDto {
  return {
    id: row.id,
    name: row.name,
    monthlyAmount: row.monthly_amount,
    description: row.description,
    isDefault: row.is_default,
  };
}

/** Planes que se ofrecen ahora, en su orden de presentación (RN-04). */
export async function listActive(db: Queryable): Promise<AdoptionPlanDto[]> {
  const { rows } = await db.query<AdoptionPlanRow>(
    `SELECT id, name, monthly_amount, description, is_default
       FROM adoption_plans
      WHERE is_active
      ORDER BY sort_order, id`,
  );
  return rows.map(mapRow);
}

export interface PlanForAdoption {
  id: number;
  name: string;
  monthlyAmount: string;
}

/** Plan que se ofrece ahora; `null` si no existe o está desactivado (CU-13 5c). */
export async function findActiveById(db: Queryable, id: number): Promise<PlanForAdoption | null> {
  const { rows } = await db.query<{ id: number; name: string; monthly_amount: string }>(
    'SELECT id, name, monthly_amount FROM adoption_plans WHERE id = $1 AND is_active',
    [id],
  );
  const row = rows[0];
  return row ? { id: row.id, name: row.name, monthlyAmount: row.monthly_amount } : null;
}

// --- Panel (CU-40) ---

export interface PlanData {
  name: string;
  monthlyAmount: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
}

interface AdminPlanRow extends AdoptionPlanRow {
  is_active: boolean;
  active_adoptions: number;
  in_use: boolean;
}

function mapAdminRow(row: AdminPlanRow): AdminPlanDto {
  return {
    ...mapRow(row),
    isActive: row.is_active,
    activeAdoptions: row.active_adoptions,
    deletable: comprobarBorradoPlan({ isDefault: row.is_default, enUso: row.in_use }) === null,
  };
}

/** A3: el plan aparece en alguna adopción, pago o suceso del historial (todas las claves que lo apuntan). */
const EN_USO = `(
     EXISTS (SELECT 1 FROM adoptions a WHERE a.plan_id = p.id OR a.next_plan_id = p.id)
  OR EXISTS (SELECT 1 FROM payments pa WHERE pa.plan_id = p.id)
  OR EXISTS (SELECT 1 FROM adoption_events e WHERE e.from_plan_id = p.id OR e.to_plan_id = p.id))`;

const SELECT_ADMIN = `
  SELECT p.id, p.name, p.monthly_amount, p.description, p.is_default, p.is_active,
         (SELECT count(*)::int FROM adoptions a WHERE a.plan_id = p.id AND a.status = 'active') AS active_adoptions,
         ${EN_USO} AS in_use
    FROM adoption_plans p`;

/** 3: el índice único `adoption_plans_name_lower_key` impide nombres repetidos. */
function traducirError(error: unknown): never {
  if (esErrorPg(error, PG_UNIQUE_VIOLATION, 'adoption_plans_name_lower_key')) throw new PlanAlreadyExistsError();
  throw error;
}

/** 2: todos los planes, también los desactivados, en su orden de presentación. */
export async function listWithCounts(db: Queryable): Promise<AdminPlanDto[]> {
  const { rows } = await db.query<AdminPlanRow>(`${SELECT_ADMIN} ORDER BY p.sort_order, p.id`);
  return rows.map(mapAdminRow);
}

/** Con `forUpdate`, bloquea la fila hasta el final de la transacción. */
export async function findWithCount(db: Queryable, id: number, forUpdate = false): Promise<AdminPlanDto | null> {
  if (forUpdate) await db.query('SELECT 1 FROM adoption_plans WHERE id = $1 FOR UPDATE', [id]);
  const { rows } = await db.query<AdminPlanRow>(`${SELECT_ADMIN} WHERE p.id = $1`, [id]);
  return rows[0] ? mapAdminRow(rows[0]) : null;
}

/** Quita la marca de «por defecto» a los demás planes (solo puede haber uno). */
export async function clearDefaultExcept(db: Queryable, id: number | null): Promise<void> {
  await db.query('UPDATE adoption_plans SET is_default = FALSE WHERE is_default AND id IS DISTINCT FROM $1', [id]);
}

/** A2: el plan nuevo se ofrece el último. */
export async function create(db: Queryable, datos: PlanData): Promise<number> {
  try {
    const { rows } = await db.query<{ id: number }>(
      `INSERT INTO adoption_plans (name, monthly_amount, description, is_default, is_active, sort_order)
       VALUES ($1, $2, $3, $4, $5, (SELECT COALESCE(max(sort_order), 0) + 1 FROM adoption_plans))
       RETURNING id`,
      [datos.name, datos.monthlyAmount, datos.description, datos.isDefault, datos.isActive],
    );
    return rows[0]!.id;
  } catch (error) {
    traducirError(error);
  }
}

export async function update(db: Queryable, id: number, datos: PlanData): Promise<void> {
  try {
    await db.query(
      `UPDATE adoption_plans
          SET name = $2, monthly_amount = $3, description = $4, is_default = $5, is_active = $6
        WHERE id = $1`,
      [id, datos.name, datos.monthlyAmount, datos.description, datos.isDefault, datos.isActive],
    );
  } catch (error) {
    traducirError(error);
  }
}

/** A3: si el plan está en uso, con la fila bloqueada hasta el final de la transacción. */
export async function findForDeletion(
  db: Queryable,
  id: number,
): Promise<{ name: string; monthlyAmount: string; isDefault: boolean; enUso: boolean } | null> {
  const { rows } = await db.query<{ name: string; monthly_amount: string; is_default: boolean; in_use: boolean }>(
    `SELECT p.name, p.monthly_amount, p.is_default, ${EN_USO} AS in_use
       FROM adoption_plans p
      WHERE p.id = $1
      FOR UPDATE OF p`,
    [id],
  );
  const row = rows[0];
  return row
    ? { name: row.name, monthlyAmount: row.monthly_amount, isDefault: row.is_default, enUso: row.in_use }
    : null;
}

/** A3: las claves `ON DELETE RESTRICT` impiden borrar un plan en uso (RN-17). */
export async function remove(db: Queryable, id: number): Promise<void> {
  try {
    await db.query('DELETE FROM adoption_plans WHERE id = $1', [id]);
  } catch (error) {
    if (esErrorPg(error, PG_FOREIGN_KEY_VIOLATION) || esErrorPg(error, PG_RESTRICT_VIOLATION)) throw new PlanHasHistoryError();
    throw error;
  }
}
