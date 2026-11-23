import type { WorkSettingsData, WorkSettingsDto } from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';

// CU-73: ajustes del trabajo diario (una sola fila, creada por seedsql.sql).

interface SettingsRow {
  late_margin_minutes: number;
}

function mapRow(row: SettingsRow): WorkSettingsDto {
  return { lateMarginMinutes: row.late_margin_minutes };
}

const POR_DEFECTO: SettingsRow = { late_margin_minutes: 30 };

export async function get(db: Queryable): Promise<WorkSettingsDto> {
  const { rows } = await db.query<SettingsRow>('SELECT late_margin_minutes FROM work_settings WHERE id = 1');
  return mapRow(rows[0] ?? POR_DEFECTO);
}

export async function update(db: Queryable, datos: WorkSettingsData, userId: number): Promise<WorkSettingsDto> {
  const { rows } = await db.query<SettingsRow>(
    `INSERT INTO work_settings (id, late_margin_minutes, updated_by) VALUES (1, $1, $2)
     ON CONFLICT (id) DO UPDATE SET late_margin_minutes = EXCLUDED.late_margin_minutes, updated_by = EXCLUDED.updated_by
     RETURNING late_margin_minutes`,
    [datos.lateMarginMinutes, userId],
  );
  return mapRow(rows[0]!);
}
