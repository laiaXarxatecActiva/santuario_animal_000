import type { Express } from 'express';
import type { Pool } from 'pg';
import { createApp } from '../../src/app.js';
import { createPool } from '../../src/db/pool.js';
import { resetDatabase } from '../../src/db/reset.js';
import { relojFijo, type Reloj } from '../../src/dominio/reloj.js';
import { databaseDir, testDatabaseUrl } from './test-db.js';

export interface TestApp {
  app: Express;
  pool: Pool;
  reloj: Reloj;
  /** Fecha de hoy según PostgreSQL (TEST_DATA.sql es relativo a ella). */
  hoy: string;
}

/**
 * Reinicia la base de datos de pruebas y crea la app. El Reloj se fija en el
 * día de carga de los datos, para que las edades y las fechas coincidan.
 */
export async function prepararApp(): Promise<TestApp> {
  await resetDatabase(testDatabaseUrl(), databaseDir);
  const pool = createPool(testDatabaseUrl());
  const { rows } = await pool.query<{ hoy: string }>('SELECT CURRENT_DATE::text AS hoy');
  const hoy = rows[0]?.hoy ?? '';
  const reloj = relojFijo(`${hoy}T12:00:00Z`);
  const app = createApp({ db: pool, reloj, uploadsDir: databaseDir, logError: () => {} });
  return { app, pool, reloj, hoy };
}
