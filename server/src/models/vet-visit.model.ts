import type { VetVisitDto, VetVisitStatus } from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';

// CU-68: visitas veterinarias programadas.

interface VisitRow {
  id: number;
  animal_id: number;
  visit_date: string;
  visit_time: string;
  reason: string;
  veterinarian: string | null;
  status: VetVisitStatus;
  vet_record_id: number | null;
  task_id: number | null;
}

function mapRow(row: VisitRow): VetVisitDto {
  return {
    id: row.id,
    animalId: row.animal_id,
    date: row.visit_date,
    time: row.visit_time,
    reason: row.reason,
    veterinarian: row.veterinarian,
    status: row.status,
    vetRecordId: row.vet_record_id,
    taskId: row.task_id,
  };
}

const SELECT = `
  SELECT v.id, v.animal_id, v.visit_date::text AS visit_date, to_char(v.visit_time, 'HH24:MI') AS visit_time,
         v.reason, v.veterinarian, v.status, v.vet_record_id,
         (SELECT i.id FROM task_instances i WHERE i.vet_visit_id = v.id AND i.status = 'pending'
           ORDER BY i.id DESC LIMIT 1) AS task_id
    FROM vet_visits v`;

/** Pestaña «Cuidados»: las programadas (por fecha) y las 5 últimas hechas o canceladas. */
export async function listByAnimal(db: Queryable, animalId: number): Promise<VetVisitDto[]> {
  const { rows } = await db.query<VisitRow>(
    `(${SELECT} WHERE v.animal_id = $1 AND v.status = 'scheduled' ORDER BY v.visit_date, v.visit_time, v.id)
     UNION ALL
     (${SELECT} WHERE v.animal_id = $1 AND v.status <> 'scheduled'
       ORDER BY v.visit_date DESC, v.visit_time DESC, v.id DESC LIMIT 5)`,
    [animalId],
  );
  return rows.map(mapRow);
}

export async function findById(
  db: Queryable,
  id: number,
  opciones: { forUpdate?: boolean } = {},
): Promise<VetVisitDto | null> {
  if (opciones.forUpdate) await db.query('SELECT 1 FROM vet_visits WHERE id = $1 FOR UPDATE', [id]);
  const { rows } = await db.query<VisitRow>(`${SELECT} WHERE v.id = $1`, [id]);
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function create(
  db: Queryable,
  animalId: number,
  d: { date: string; time: string; reason: string; veterinarian: string | null },
  autorId: number,
): Promise<number> {
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO vet_visits (animal_id, visit_date, visit_time, reason, veterinarian, created_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [animalId, d.date, d.time, d.reason, d.veterinarian, autorId],
  );
  return rows[0]!.id;
}

export async function update(
  db: Queryable,
  id: number,
  d: { date: string; time: string; reason: string; veterinarian: string | null },
): Promise<void> {
  await db.query(
    'UPDATE vet_visits SET visit_date = $2, visit_time = $3, reason = $4, veterinarian = $5 WHERE id = $1',
    [id, d.date, d.time, d.reason, d.veterinarian],
  );
}

export async function setStatus(
  db: Queryable,
  id: number,
  status: VetVisitStatus,
  vetRecordId: number | null = null,
): Promise<void> {
  await db.query('UPDATE vet_visits SET status = $2, vet_record_id = $3 WHERE id = $1', [id, status, vetRecordId]);
}

/** CU-68: visitas programadas de un día, para avisar. */
export async function listScheduledOn(
  db: Queryable,
  fecha: string,
): Promise<
  { id: number; time: string; reason: string; animalId: number; animalName: string; zoneId: number | null }[]
> {
  const { rows } = await db.query<{
    id: number;
    visit_time: string;
    reason: string;
    animal_id: number;
    animal_name: string;
    zone_id: number | null;
  }>(
    `SELECT v.id, to_char(v.visit_time, 'HH24:MI') AS visit_time, v.reason, a.id AS animal_id, a.name AS animal_name,
            a.zone_id
       FROM vet_visits v JOIN animals a ON a.id = v.animal_id
      WHERE v.visit_date = $1 AND v.status = 'scheduled'
      ORDER BY v.visit_time, v.id`,
    [fecha],
  );
  return rows.map((r) => ({
    id: r.id,
    time: r.visit_time,
    reason: r.reason,
    animalId: r.animal_id,
    animalName: r.animal_name,
    zoneId: r.zone_id,
  }));
}
