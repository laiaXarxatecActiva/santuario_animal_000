import type { DietItemData, DietItemDto, FoodUnit } from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';
import { dietaVigente } from '../dominio/cuidados.js';

// CU-65: alimentos de la dieta de cada animal.

interface DietItemRow {
  id: number;
  animal_id: number;
  food: string;
  quantity: string;
  unit: FoodUnit;
  schedule: string | null;
  notes: string | null;
  start_date: string;
  end_date: string | null;
}

function mapRow(row: DietItemRow, hoy: string): DietItemDto {
  return {
    id: row.id,
    animalId: row.animal_id,
    food: row.food,
    quantity: row.quantity,
    unit: row.unit,
    schedule: row.schedule,
    notes: row.notes,
    startDate: row.start_date,
    endDate: row.end_date,
    isCurrent: dietaVigente({ startDate: row.start_date, endDate: row.end_date }, hoy),
  };
}

const SELECT = `
  SELECT id, animal_id, food, quantity, unit, schedule, notes, start_date::text AS start_date, end_date::text AS end_date
    FROM diet_items`;

/** Primero las vigentes o futuras; después las terminadas, de la más reciente a la más antigua. */
export async function listByAnimal(db: Queryable, animalId: number, hoy: string): Promise<DietItemDto[]> {
  const { rows } = await db.query<DietItemRow>(
    `${SELECT} WHERE animal_id = $1
      ORDER BY (end_date IS NOT NULL AND end_date < $2), COALESCE(end_date, 'infinity'::date) DESC, start_date DESC, id DESC`,
    [animalId, hoy],
  );
  return rows.map((r) => mapRow(r, hoy));
}

export async function findById(db: Queryable, id: number, hoy: string): Promise<DietItemDto | null> {
  const { rows } = await db.query<DietItemRow>(`${SELECT} WHERE id = $1`, [id]);
  return rows[0] ? mapRow(rows[0], hoy) : null;
}

export async function create(db: Queryable, animalId: number, d: DietItemData, autorId: number): Promise<number> {
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO diet_items (animal_id, food, quantity, unit, schedule, notes, start_date, end_date, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [animalId, d.food, d.quantity, d.unit, d.schedule, d.notes, d.startDate, d.endDate, autorId],
  );
  return rows[0]!.id;
}

/** Devuelve `false` si no existe. */
export async function update(db: Queryable, id: number, d: DietItemData): Promise<boolean> {
  const { rowCount } = await db.query(
    `UPDATE diet_items SET food = $2, quantity = $3, unit = $4, schedule = $5, notes = $6, start_date = $7, end_date = $8
      WHERE id = $1`,
    [id, d.food, d.quantity, d.unit, d.schedule, d.notes, d.startDate, d.endDate],
  );
  return (rowCount ?? 0) > 0;
}

export async function remove(db: Queryable, id: number): Promise<boolean> {
  const { rowCount } = await db.query('DELETE FROM diet_items WHERE id = $1', [id]);
  return (rowCount ?? 0) > 0;
}
