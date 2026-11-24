import { DEFAULT_LOW_INTAKE_MEALS, type WorkSettingsData, type WorkSettingsDto } from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';

// CU-73 y CU-67: ajustes del trabajo diario (una sola fila, creada por seedsql.sql).

interface SettingsRow {
  late_margin_minutes: number;
  low_intake_meals: number;
}

function mapRow(row: SettingsRow): Required<WorkSettingsDto> {
  return { lateMarginMinutes: row.late_margin_minutes, lowIntakeMeals: row.low_intake_meals };
}

const POR_DEFECTO: SettingsRow = { late_margin_minutes: 30, low_intake_meals: DEFAULT_LOW_INTAKE_MEALS };

export async function get(db: Queryable): Promise<Required<WorkSettingsDto>> {
  const { rows } = await db.query<SettingsRow>(
    'SELECT late_margin_minutes, low_intake_meals FROM work_settings WHERE id = 1',
  );
  return mapRow(rows[0] ?? POR_DEFECTO);
}

/** Lo que no se envía (`lowIntakeMeals`) se queda como estaba. */
export async function update(
  db: Queryable,
  datos: WorkSettingsData,
  userId: number,
): Promise<Required<WorkSettingsDto>> {
  const { rows } = await db.query<SettingsRow>(
    `INSERT INTO work_settings (id, late_margin_minutes, low_intake_meals, updated_by)
     VALUES (1, $1, COALESCE($2, ${DEFAULT_LOW_INTAKE_MEALS}), $3)
     ON CONFLICT (id) DO UPDATE
       SET late_margin_minutes = EXCLUDED.late_margin_minutes,
           low_intake_meals = COALESCE($2, work_settings.low_intake_meals),
           updated_by = EXCLUDED.updated_by
     RETURNING late_margin_minutes, low_intake_meals`,
    [datos.lateMarginMinutes, datos.lowIntakeMeals ?? null, userId],
  );
  return mapRow(rows[0]!);
}
