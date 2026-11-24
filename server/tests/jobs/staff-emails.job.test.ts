import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { relojFijo } from '../../src/dominio/reloj.js';
import { runCoverageCheck } from '../../src/jobs/coverage-check.job.js';
import { runDailySummary } from '../../src/jobs/daily-summary.job.js';
import { runStaffEmails } from '../../src/jobs/staff-emails.job.js';
import { runTaskAlerts } from '../../src/jobs/task-alerts.job.js';
import { prepararApp, TEST_CLIENT_URL, type TestApp } from '../helpers/test-app.js';
import { depsDePrueba } from './helpers.js';

// En TEST_DATA.sql la dosis de doxiciclina de Carbón de hoy (10:00) sigue
// pendiente; Marta (1) y Javier (2) son los administradores, y en la clínica
// tienen turno hoy Nuria (3, mañana) y Carmen (5, tarde).

let t: TestApp;
beforeAll(async () => {
  t = await prepararApp();
});
afterAll(() => t.pool.end());
beforeEach(() => {
  t.mailer.outbox.length = 0;
});

/** Las dependencias de las tareas, a una hora de Madrid de hoy. */
const a = (hora: string) => ({ ...depsDePrueba(t), reloj: relojFijo(`${t.hoy}T${hora}:00+01:00`) });

const pendientes = async () =>
  (await t.pool.query<{ n: number }>('SELECT count(*)::int AS n FROM notifications WHERE email_pending')).rows[0]!.n;

describe('CU-73 Avisos del personal por email', () => {
  it('los avisos de los tipos elegidos quedan pendientes y la tarea los envía una sola vez', async () => {
    // Dosis de hoy no dada: medication_missed va por email por defecto.
    const avisos = await runTaskAlerts(a('11:00'));
    expect(avisos.medicationMissed).toBe(1);
    expect(await pendientes()).toBe(4);

    const res = await runStaffEmails(a('11:01'));
    expect(res).toEqual({ sent: 4, failed: 0 });
    expect(t.mailer.outbox.map((m) => m.to).sort()).toEqual([
      'carmen.boix@santuario.test',
      'javier.ortega@santuario.test',
      'marta.soler@santuario.test',
      'nuria.peris@santuario.test',
    ]);
    const deMarta = t.mailer.outbox.find((m) => m.to === 'marta.soler@santuario.test')!;
    expect(deMarta.subject).toBe('Medicación no dada');
    expect(deMarta.text).toContain('Hola, Marta:');
    expect(deMarta.text).toContain('Carbón no ha recibido la dosis de las 10:00: Doxiciclina · 100 mg.');
    expect(deMarta.text).toContain(`${TEST_CLIENT_URL}/admin/animals/10/care`);

    // Idempotente: no se vuelven a enviar.
    expect(await pendientes()).toBe(0);
    expect(await runStaffEmails(a('11:06'))).toEqual({ sent: 0, failed: 0 });
  });

  it('los tipos que no están elegidos solo van a la campana', async () => {
    await t.pool.query("UPDATE work_settings SET email_alert_types = ARRAY['low_intake']");
    await t.pool.query('DELETE FROM staff_alerts');
    await runCoverageCheck(a('12:00'));
    expect(await pendientes()).toBe(0);
    await t.pool.query(
      "UPDATE work_settings SET email_alert_types = ARRAY['coverage_gap', 'low_intake', 'medication_missed', 'incident_reported']",
    );
  });

  it('un fallo al enviar no detiene la tarea: se cuenta y no se reintenta', async () => {
    await t.pool.query(
      `INSERT INTO notifications (user_id, type, message, link, email_pending)
       VALUES (1, 'incident_reported', 'Uno', '/admin/incidents/1', TRUE),
              (2, 'incident_reported', 'Dos', '/admin/incidents/1', TRUE)`,
    );
    t.mailer.failNext = true;
    const errores: unknown[] = [];
    expect(await runStaffEmails({ ...a('12:30'), logError: (e: unknown) => errores.push(e) })).toEqual({
      sent: 1,
      failed: 1,
    });
    expect(errores).toHaveLength(1);
    expect(await pendientes()).toBe(0);
  });

  it('a un trabajador desactivado no se le envía', async () => {
    await t.pool.query('UPDATE users SET is_active = FALSE WHERE id = 2');
    await t.pool.query(
      "INSERT INTO notifications (user_id, type, message, link, email_pending) VALUES (2, 'low_intake', 'X', NULL, TRUE)",
    );
    expect(await runStaffEmails(a('12:40'))).toEqual({ sent: 0, failed: 0 });
    expect(await pendientes()).toBe(0);
    await t.pool.query('UPDATE users SET is_active = TRUE WHERE id = 2');
  });

  it('en el idioma de cada persona', async () => {
    await t.pool.query("UPDATE users SET preferred_language = 'en' WHERE id = 1");
    await t.pool.query(
      "INSERT INTO notifications (user_id, type, message, link, email_pending) VALUES (1, 'coverage_gap', 'Gap', '/admin/shifts', TRUE)",
    );
    await runStaffEmails(a('12:50'));
    expect(t.mailer.outbox[0]).toMatchObject({ subject: 'Shift without enough staff' });
    expect(t.mailer.outbox[0]?.text).toContain('Hello Marta,');
    await t.pool.query("UPDATE users SET preferred_language = 'es' WHERE id = 1");
  });
});

describe('CU-74 Resumen diario por email', () => {
  it('desactivado por defecto: no envía nada', async () => {
    expect(await runDailySummary(a('21:00'))).toEqual({ sent: 0 });
    expect(t.mailer.outbox).toEqual([]);
  });

  it('activado, sale a su hora a los administradores, una vez al día', async () => {
    await t.pool.query("UPDATE work_settings SET daily_summary_enabled = TRUE, daily_summary_time = '20:00'");
    expect(await runDailySummary(a('19:45'))).toEqual({ sent: 0 });

    expect(await runDailySummary(a('20:00'))).toEqual({ sent: 2 });
    expect(t.mailer.outbox.map((m) => m.to).sort()).toEqual([
      'javier.ortega@santuario.test',
      'marta.soler@santuario.test',
    ]);
    const resumen = t.mailer.outbox[0]!;
    expect(resumen.subject).toMatch(/^Resumen del día/);
    expect(resumen.text).toMatch(/Tareas: \d+ hechas, \d+ no realizadas y \d+ pendientes de \d+\./);
    expect(resumen.text).toContain('Medicación no dada:');
    expect(resumen.text).toContain('Doxiciclina · 100 mg');
    expect(resumen.text).toContain('Incidencias abiertas: 1; en curso: 1.');
    expect(resumen.text).toContain(`${TEST_CLIENT_URL}/admin/today`);

    expect(await runDailySummary(a('20:15'))).toEqual({ sent: 0 });
    expect(t.mailer.outbox).toHaveLength(2);
  });
});
