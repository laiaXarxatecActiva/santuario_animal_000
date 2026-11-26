import type { AdminUserLinkedDataDto } from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';

// CU-75: borrar del todo una cuenta desde el panel.
//
// Hay dos clases de datos enlazados con un usuario:
// - Lo que es «suyo» (sus adopciones con sus pagos, sus donaciones, las
//   incidencias que comunicó, sus notas de relevo, sus actualizaciones de
//   animales, las tareas que hizo o que solo eran suyas y sus entradas del
//   registro de actividad): se cuenta y, si se fuerza el borrado, se borra.
// - Lo que es del santuario y solo lleva su nombre como autor (historial
//   veterinario, pautas, plantillas, dietas, pagos de otras personas apuntados
//   a mano…): nunca se borra; se queda sin autor (`NULL`).
// Sesiones, tokens, avisos, lecturas, cualificaciones, turnos y ausencias se
// borran solos con la cuenta (`ON DELETE CASCADE`).

/** Tareas que son de la persona: las que completó y las que solo tenía ella (sin zona). */
const TAREAS_SUYAS = "(status = 'completed' AND resolved_by = $1) OR (assigned_to = $1 AND zone_id IS NULL)";
const ADOPCIONES_SUYAS = 'user_id = $1 OR gifted_by_user_id = $1';

interface LinkedDataRow {
  adoptions: number;
  payments: number;
  donations: number;
  incidents: number;
  handover_notes: number;
  animal_updates: number;
  tasks: number;
  activity_logs: number;
}

/** Paso 2: cuánto se borraría con la cuenta. */
export async function countLinkedData(db: Queryable, userId: number): Promise<AdminUserLinkedDataDto> {
  const { rows } = await db.query<LinkedDataRow>(
    `SELECT (SELECT count(*) FROM adoptions WHERE ${ADOPCIONES_SUYAS})::int AS adoptions,
            (SELECT count(*) FROM payments p JOIN adoptions a ON a.id = p.adoption_id
              WHERE a.user_id = $1 OR a.gifted_by_user_id = $1)::int AS payments,
            (SELECT count(*) FROM donations WHERE user_id = $1)::int AS donations,
            (SELECT count(*) FROM incidents WHERE reported_by = $1)::int AS incidents,
            (SELECT count(*) FROM handover_notes WHERE author_id = $1)::int AS handover_notes,
            (SELECT count(*) FROM animal_updates WHERE author_id = $1)::int AS animal_updates,
            (SELECT count(*) FROM task_instances WHERE ${TAREAS_SUYAS})::int AS tasks,
            (SELECT count(*) FROM activity_logs WHERE user_id = $1)::int AS activity_logs`,
    [userId],
  );
  const r = rows[0]!;
  const datos = {
    adoptions: r.adoptions,
    payments: r.payments,
    donations: r.donations,
    incidents: r.incidents,
    handoverNotes: r.handover_notes,
    animalUpdates: r.animal_updates,
    tasks: r.tasks,
    activityLogs: r.activity_logs,
  };
  return { ...datos, total: Object.values(datos).reduce((suma, n) => suma + n, 0) };
}

/**
 * Paso 3b: borra lo que es de la persona y devuelve las URL de los archivos
 * que se quedan sin uso (fotos de sus incidencias y de sus actualizaciones),
 * para borrarlos del disco cuando la transacción termine.
 */
export async function deleteOwnedData(db: Queryable, userId: number): Promise<string[]> {
  const { rows: archivos } = await db.query<{ url: string | null }>(
    `SELECT ip.url FROM incident_photos ip JOIN incidents i ON i.id = ip.incident_id WHERE i.reported_by = $1
     UNION ALL
     SELECT unnest(ARRAY[p.url, p.thumbnail_url]) FROM photos p
       JOIN animal_updates u ON u.id = p.update_id WHERE u.author_id = $1`,
    [userId],
  );
  await db.query(`DELETE FROM payments WHERE adoption_id IN (SELECT id FROM adoptions WHERE ${ADOPCIONES_SUYAS})`, [
    userId,
  ]);
  await db.query(`DELETE FROM adoptions WHERE ${ADOPCIONES_SUYAS}`, [userId]);
  await db.query('DELETE FROM donations WHERE user_id = $1', [userId]);
  await db.query('DELETE FROM incidents WHERE reported_by = $1', [userId]);
  await db.query('DELETE FROM handover_notes WHERE author_id = $1', [userId]);
  await db.query('DELETE FROM animal_updates WHERE author_id = $1', [userId]);
  await db.query(`DELETE FROM task_instances WHERE ${TAREAS_SUYAS}`, [userId]);
  await db.query('DELETE FROM activity_logs WHERE user_id = $1', [userId]);
  return archivos.flatMap((a) => (a.url ? [a.url] : []));
}

/** Columnas que solo guardan quién creó o apuntó un registro del santuario. */
const AUTORIA: ReadonlyArray<readonly [tabla: string, columna: string]> = [
  ['photos', 'uploaded_by'],
  ['adoptions', 'created_by'],
  ['payments', 'recorded_by'],
  ['donations', 'recorded_by'],
  ['vet_records', 'created_by'],
  ['vet_visits', 'created_by'],
  ['medication_plans', 'created_by'],
  ['task_templates', 'created_by'],
  ['task_instances', 'created_by'],
  ['task_instances', 'assigned_to'],
  ['task_instances', 'resolved_by'],
  ['diet_items', 'created_by'],
  ['feeding_logs', 'recorded_by'],
  ['incidents', 'resolved_by'],
  ['work_settings', 'updated_by'],
];

/** Pasos 3 y 3b: lo que es del santuario se conserva, pero sin autor. */
export async function clearAuthorship(db: Queryable, userId: number): Promise<void> {
  for (const [tabla, columna] of AUTORIA) {
    await db.query(`UPDATE ${tabla} SET ${columna} = NULL WHERE ${columna} = $1`, [userId]);
  }
}

/** Paso 3: borra la cuenta (lo demás que cuelga de ella se borra en cascada). */
export async function deleteUser(db: Queryable, userId: number): Promise<void> {
  await db.query('DELETE FROM users WHERE id = $1', [userId]);
}
