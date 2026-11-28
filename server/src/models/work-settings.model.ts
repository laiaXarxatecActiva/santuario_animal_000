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

// CU-55 y CU-67: ajustes del trabajo diario (una sola fila, creada por seedsql.sql).

/** Lo que usan los servicios: el margen de «atrasada» y el umbral del aviso de comer poco. */
export interface AjustesTrabajo extends WorkSettingsDto {
  lowIntakeMeals: number;
}

interface SettingsRow {
  late_margin_minutes: number;
  low_intake_meals: number;
}

function mapRow(row: SettingsRow): AjustesTrabajo {
  return { lateMarginMinutes: row.late_margin_minutes, lowIntakeMeals: row.low_intake_meals };
}

const POR_DEFECTO: SettingsRow = { late_margin_minutes: 30, low_intake_meals: DEFAULT_LOW_INTAKE_MEALS };

export async function get(db: Queryable): Promise<AjustesTrabajo> {
  const { rows } = await db.query<SettingsRow>(
    'SELECT late_margin_minutes, low_intake_meals FROM work_settings WHERE id = 1',
  );
  return mapRow(rows[0] ?? POR_DEFECTO);
}

/** CU-55: solo el margen; el número de comidas se guarda con los avisos (`updateAlerts`). */
export async function update(db: Queryable, datos: WorkSettingsData, userId: number): Promise<WorkSettingsDto> {
  const { rows } = await db.query<SettingsRow>(
    `INSERT INTO work_settings (id, late_margin_minutes, updated_by)
     VALUES (1, $1, $2)
     ON CONFLICT (id) DO UPDATE
       SET late_margin_minutes = EXCLUDED.late_margin_minutes,
           updated_by = EXCLUDED.updated_by
     RETURNING late_margin_minutes, low_intake_meals`,
    [datos.lateMarginMinutes, userId],
  );
  return { lateMarginMinutes: rows[0]!.late_margin_minutes };
}

// CU-73, CU-74 y CU-67: avisos por email, resumen diario y umbral de comer poco (en la misma fila).

interface AlertRow {
  email_alert_types: string[];
  daily_summary_enabled: boolean;
  daily_summary_time: string;
  low_intake_meals: number;
}

const tiposValidos = (tipos: readonly string[]): StaffEmailAlertType[] =>
  STAFF_EMAIL_ALERT_TYPES.filter((t) => tipos.includes(t));

function mapAlertRow(row: AlertRow): AlertSettingsDto {
  return {
    emailAlertTypes: tiposValidos(row.email_alert_types),
    dailySummaryEnabled: row.daily_summary_enabled,
    dailySummaryTime: row.daily_summary_time,
    lowIntakeMeals: row.low_intake_meals,
  };
}

const COLUMNAS_AVISOS =
  "email_alert_types, daily_summary_enabled, to_char(daily_summary_time, 'HH24:MI') AS daily_summary_time, low_intake_meals";

export async function getAlerts(db: Queryable): Promise<AlertSettingsDto> {
  const { rows } = await db.query<AlertRow>(`SELECT ${COLUMNAS_AVISOS} FROM work_settings WHERE id = 1`);
  return rows[0]
    ? mapAlertRow(rows[0])
    : {
        emailAlertTypes: [...DEFAULT_EMAIL_ALERT_TYPES],
        dailySummaryEnabled: false,
        dailySummaryTime: DEFAULT_DAILY_SUMMARY_TIME,
        lowIntakeMeals: DEFAULT_LOW_INTAKE_MEALS,
      };
}

export async function updateAlerts(db: Queryable, datos: AlertSettingsData, userId: number): Promise<AlertSettingsDto> {
  const { rows } = await db.query<AlertRow>(
    `INSERT INTO work_settings (id, email_alert_types, daily_summary_enabled, daily_summary_time, low_intake_meals, updated_by)
     VALUES (1, $1::text[], $2, $3::time, COALESCE($4::smallint, ${DEFAULT_LOW_INTAKE_MEALS}), $5)
     ON CONFLICT (id) DO UPDATE
       SET email_alert_types = EXCLUDED.email_alert_types,
           daily_summary_enabled = EXCLUDED.daily_summary_enabled,
           daily_summary_time = EXCLUDED.daily_summary_time,
           low_intake_meals = COALESCE($4::smallint, work_settings.low_intake_meals),
           updated_by = EXCLUDED.updated_by
     RETURNING ${COLUMNAS_AVISOS}`,
    [datos.emailAlertTypes, datos.dailySummaryEnabled, datos.dailySummaryTime, datos.lowIntakeMeals ?? null, userId],
  );
  return mapAlertRow(rows[0]!);
}
