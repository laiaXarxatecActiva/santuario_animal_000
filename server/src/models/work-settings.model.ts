import {
  DEFAULT_DAILY_SUMMARY_TIME,
  DEFAULT_EMAIL_ALERT_TYPES,
  DEFAULT_LOW_INTAKE_MEALS,
  STAFF_EMAIL_ALERT_TYPES,
  type AlertSettingsData,
  type AlertSettingsDto,
  type StaffEmailAlertType,
  type WorkSettingsData,
  type WorkSettingsDto,
} from '@sanctuary/shared';
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

// CU-73 y CU-74: avisos por email y resumen diario (en la misma fila).

interface AlertRow {
  email_alert_types: string[];
  daily_summary_enabled: boolean;
  daily_summary_time: string;
}

const tiposValidos = (tipos: readonly string[]): StaffEmailAlertType[] =>
  STAFF_EMAIL_ALERT_TYPES.filter((t) => tipos.includes(t));

function mapAlertRow(row: AlertRow): AlertSettingsDto {
  return {
    emailAlertTypes: tiposValidos(row.email_alert_types),
    dailySummaryEnabled: row.daily_summary_enabled,
    dailySummaryTime: row.daily_summary_time,
  };
}

const COLUMNAS_AVISOS =
  "email_alert_types, daily_summary_enabled, to_char(daily_summary_time, 'HH24:MI') AS daily_summary_time";

export async function getAlerts(db: Queryable): Promise<AlertSettingsDto> {
  const { rows } = await db.query<AlertRow>(`SELECT ${COLUMNAS_AVISOS} FROM work_settings WHERE id = 1`);
  return rows[0]
    ? mapAlertRow(rows[0])
    : {
        emailAlertTypes: [...DEFAULT_EMAIL_ALERT_TYPES],
        dailySummaryEnabled: false,
        dailySummaryTime: DEFAULT_DAILY_SUMMARY_TIME,
      };
}

export async function updateAlerts(db: Queryable, datos: AlertSettingsData, userId: number): Promise<AlertSettingsDto> {
  const { rows } = await db.query<AlertRow>(
    `INSERT INTO work_settings (id, email_alert_types, daily_summary_enabled, daily_summary_time, updated_by)
     VALUES (1, $1::text[], $2, $3::time, $4)
     ON CONFLICT (id) DO UPDATE
       SET email_alert_types = EXCLUDED.email_alert_types,
           daily_summary_enabled = EXCLUDED.daily_summary_enabled,
           daily_summary_time = EXCLUDED.daily_summary_time,
           updated_by = EXCLUDED.updated_by
     RETURNING ${COLUMNAS_AVISOS}`,
    [datos.emailAlertTypes, datos.dailySummaryEnabled, datos.dailySummaryTime, userId],
  );
  return mapAlertRow(rows[0]!);
}
