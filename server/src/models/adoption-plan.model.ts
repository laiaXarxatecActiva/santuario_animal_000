import type { AdoptionPlanDto } from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';

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
