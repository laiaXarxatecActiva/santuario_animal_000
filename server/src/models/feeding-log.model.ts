import type { FeedingLogDto, IntakeLevel } from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';
import type { Ingesta } from '../dominio/cuidados.js';

// CU-66: lo que comió cada animal en cada tarea de alimentación.

export async function insertMany(
  db: Queryable,
  taskId: number,
  ingestas: readonly Ingesta[],
  datos: { recordedBy: number; recordedAt: Date },
): Promise<void> {
  if (ingestas.length === 0) return;
  await db.query(
    `INSERT INTO feeding_logs (task_id, animal_id, intake, recorded_by, recorded_at)
     SELECT $1, x.animal_id, x.intake, $4, $5
       FROM unnest($2::int[], $3::text[]) AS x (animal_id, intake)`,
    [taskId, ingestas.map((i) => i.animalId), ingestas.map((i) => i.intake), datos.recordedBy, datos.recordedAt],
  );
}

/** CU-67: las últimas tomas de un animal, de la más reciente a la más antigua. */
export async function recentOfAnimal(
  db: Queryable,
  animalId: number,
  limite: number,
): Promise<{ taskId: number; intake: IntakeLevel }[]> {
  const { rows } = await db.query<{ task_id: number; intake: IntakeLevel }>(
    `SELECT f.task_id, f.intake
       FROM feeding_logs f JOIN task_instances i ON i.id = f.task_id
      WHERE f.animal_id = $1
      ORDER BY i.due_at DESC, i.id DESC
      LIMIT $2`,
    [animalId, limite],
  );
  return rows.map((r) => ({ taskId: r.task_id, intake: r.intake }));
}

/** Pestaña «Cuidados»: las tomas desde un día, de la más reciente a la más antigua. */
export async function listOfAnimal(db: Queryable, animalId: number, desde: string): Promise<FeedingLogDto[]> {
  const { rows } = await db.query<{
    task_id: number;
    due_date: string;
    due_time: string;
    intake: IntakeLevel;
    recorded_by: number | null;
    recorded_name: string | null;
  }>(
    `SELECT f.task_id, i.due_date::text AS due_date, to_char(i.due_time, 'HH24:MI') AS due_time, f.intake,
            f.recorded_by, u.first_name || ' ' || u.last_name AS recorded_name
       FROM feeding_logs f
       JOIN task_instances i ON i.id = f.task_id
       LEFT JOIN users u ON u.id = f.recorded_by
      WHERE f.animal_id = $1 AND i.due_date >= $2
      ORDER BY i.due_at DESC, i.id DESC`,
    [animalId, desde],
  );
  return rows.map((r) => ({
    taskId: r.task_id,
    date: r.due_date,
    time: r.due_time,
    intake: r.intake,
    recordedBy: r.recorded_by === null ? null : { id: r.recorded_by, name: r.recorded_name ?? '' },
  }));
}
