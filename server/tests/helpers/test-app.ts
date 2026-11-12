import type { Express } from 'express';
import type { Pool } from 'pg';
import { createApp, type AppOptions } from '../../src/app.js';
import { createPool } from '../../src/db/pool.js';
import { resetDatabase } from '../../src/db/reset.js';
import { relojFijo, type Reloj } from '../../src/dominio/reloj.js';
import { createEmailService, createMemoryMailer, type MemoryMailer } from '../../src/services/email/email.service.js';
import { createSimulatedGateway } from '../../src/services/payment/simulated.gateway.js';
import { databaseDir, testDatabaseUrl } from './test-db.js';

export interface TestApp {
  app: Express;
  pool: Pool;
  reloj: Reloj;
  /** Fecha de hoy según PostgreSQL (TEST_DATA.sql es relativo a ella). */
  hoy: string;
  /** Buzón en memoria con los emails enviados. */
  mailer: MemoryMailer;
}

export const TEST_CLIENT_URL = 'http://localhost:5173';

/** Opciones comunes de la app en las pruebas (sin base de datos ni reloj). */
export function opcionesDePrueba(
  mailer: MemoryMailer = createMemoryMailer(),
  reloj: Reloj = relojFijo('2026-11-12T12:00:00Z'),
) {
  return {
    // PAYMENT_SIMULATION_MODE=always_succeed en las pruebas (TECH_SPEC §15).
    payments: createSimulatedGateway({ mode: 'always_succeed', reloj }),
    uploadsDir: databaseDir,
    logError: () => {},
    sessionSecret: 'secreto-de-pruebas-de-al-menos-32-caracteres',
    clientUrl: TEST_CLIENT_URL,
    email: createEmailService({ mailer, from: 'Santuario <no-reply@santuario.test>' }),
  } satisfies Partial<AppOptions>;
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
  const mailer = createMemoryMailer();
  const app = createApp({ db: pool, reloj, ...opcionesDePrueba(mailer, reloj) });
  return { app, pool, reloj, hoy, mailer };
}

/** Token del enlace (`?token=...`) del último email enviado a una dirección. */
export function tokenDelEmail(mailer: MemoryMailer, to: string): string {
  const email = mailer.outbox.filter((m) => m.to === to).at(-1);
  const token = email?.text.match(/[?&]token=([A-Za-z0-9_-]+)/)?.[1];
  if (!token) throw new Error(`No hay ningún email con enlace para ${to}`);
  return token;
}
