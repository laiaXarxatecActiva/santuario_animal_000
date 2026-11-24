import type { AnimalStatus, MedicationPlanData, MedicationPlanDto, MedicationRoute } from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';
import { pautaActiva } from '../dominio/cuidados.js';

// CU-69: pautas de medicación.

interface PlanRow {
  id: number;
  animal_id: number;
  medication: string;
  dose: string;
  route: MedicationRoute;
  times: string[];
  start_date: string;
  end_date: string | null;
  qualification_id: number | null;
  qualification_name: string | null;
  notes: string | null;
  doses_given: number;
  doses_missed: number;
}

function mapRow(row: PlanRow, hoy: string): MedicationPlanDto {
  return {
    id: row.id,
    animalId: row.animal_id,
    medication: row.medication,
    dose: row.dose,
    route: row.route,
    times: row.times,
    startDate: row.start_date,
    endDate: row.end_date,
    qualification:
      row.qualification_id === null ? null : { id: row.qualification_id, name: row.qualification_name ?? '' },
    notes: row.notes,
    isActive: pautaActiva({ endDate: row.end_date }, hoy),
    dosesGiven: row.doses_given,
    dosesMissed: row.doses_missed,
    hasHistory: row.doses_given + row.doses_missed > 0,
  };
}

const SELECT = `
  SELECT p.id, p.animal_id, p.medication, p.dose, p.route,
         ARRAY(SELECT to_char(x, 'HH24:MI') FROM unnest(p.times) AS x ORDER BY x) AS times,
         p.start_date::text AS start_date, p.end_date::text AS end_date,
         p.qualification_id, q.name AS qualification_name, p.notes,
         (SELECT count(*)::int FROM task_instances i WHERE i.medication_plan_id = p.id AND i.status = 'completed') AS doses_given,
         (SELECT count(*)::int FROM task_instances i WHERE i.medication_plan_id = p.id AND i.status = 'not_done') AS doses_missed
    FROM medication_plans p
    LEFT JOIN qualifications q ON q.id = p.qualification_id`;

/** Primero las activas; después las terminadas, de la más reciente a la más antigua. */
export async function listByAnimal(db: Queryable, animalId: number, hoy: string): Promise<MedicationPlanDto[]> {
  const { rows } = await db.query<PlanRow>(
    `${SELECT} WHERE p.animal_id = $1
      ORDER BY (p.end_date IS NOT NULL AND p.end_date < $2), p.start_date DESC, p.id DESC`,
    [animalId, hoy],
  );
  return rows.map((r) => mapRow(r, hoy));
}

export async function findById(
  db: Queryable,
  id: number,
  hoy: string,
  opciones: { forUpdate?: boolean } = {},
): Promise<MedicationPlanDto | null> {
  if (opciones.forUpdate) await db.query('SELECT 1 FROM medication_plans WHERE id = $1 FOR UPDATE', [id]);
  const { rows } = await db.query<PlanRow>(`${SELECT} WHERE p.id = $1`, [id]);
  return rows[0] ? mapRow(rows[0], hoy) : null;
}

export async function create(db: Queryable, animalId: number, d: MedicationPlanData, autorId: number): Promise<number> {
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO medication_plans (animal_id, medication, dose, route, times, start_date, end_date,
                                   qualification_id, notes, created_by)
     VALUES ($1, $2, $3, $4, $5::time[], $6, $7, $8, $9, $10) RETURNING id`,
    [animalId, d.medication, d.dose, d.route, d.times, d.startDate, d.endDate, d.qualificationId, d.notes, autorId],
  );
  return rows[0]!.id;
}

export async function update(db: Queryable, id: number, d: MedicationPlanData): Promise<void> {
  await db.query(
    `UPDATE medication_plans
        SET medication = $2, dose = $3, route = $4, times = $5::time[], start_date = $6, end_date = $7,
            qualification_id = $8, notes = $9
      WHERE id = $1`,
    [id, d.medication, d.dose, d.route, d.times, d.startDate, d.endDate, d.qualificationId, d.notes],
  );
}

export async function setEndDate(db: Queryable, id: number, fecha: string): Promise<void> {
  await db.query('UPDATE medication_plans SET end_date = $2 WHERE id = $1', [id, fecha]);
}

export async function remove(db: Queryable, id: number): Promise<void> {
  await db.query('DELETE FROM medication_plans WHERE id = $1', [id]);
}

/** CU-58: lo que hace falta para generar las dosis. */
export interface PautaParaGenerar {
  id: number;
  medication: string;
  dose: string;
  notes: string | null;
  times: string[];
  startDate: string;
  endDate: string | null;
  qualificationId: number | null;
  animal: { id: number; status: AnimalStatus; zoneId: number | null };
}

/** Pautas con días dentro del rango; con `id`, solo esa. */
export async function listForGeneration(
  db: Queryable,
  filtros: { desde: string; hasta: string; id?: number },
): Promise<PautaParaGenerar[]> {
  const { rows } = await db.query<{
    id: number;
    medication: string;
    dose: string;
    notes: string | null;
    times: string[];
    start_date: string;
    end_date: string | null;
    qualification_id: number | null;
    animal_id: number;
    animal_status: AnimalStatus;
    zone_id: number | null;
  }>(
    `SELECT p.id, p.medication, p.dose, p.notes,
            ARRAY(SELECT to_char(x, 'HH24:MI') FROM unnest(p.times) AS x ORDER BY x) AS times,
            p.start_date::text AS start_date, p.end_date::text AS end_date, p.qualification_id,
            a.id AS animal_id, a.status AS animal_status, a.zone_id
       FROM medication_plans p JOIN animals a ON a.id = p.animal_id
      WHERE p.start_date <= $2 AND (p.end_date IS NULL OR p.end_date >= $1) AND ($3::int IS NULL OR p.id = $3)
      ORDER BY p.id`,
    [filtros.desde, filtros.hasta, filtros.id ?? null],
  );
  return rows.map((r) => ({
    id: r.id,
    medication: r.medication,
    dose: r.dose,
    notes: r.notes,
    times: r.times,
    startDate: r.start_date,
    endDate: r.end_date,
    qualificationId: r.qualification_id,
    animal: { id: r.animal_id, status: r.animal_status, zoneId: r.zone_id },
  }));
}

export async function lock(db: Queryable, id: number): Promise<void> {
  await db.query('SELECT 1 FROM medication_plans WHERE id = $1 FOR UPDATE', [id]);
}
