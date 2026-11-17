import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runMonthlyDigest } from '../../src/jobs/monthly-digest.job.js';
import { prepararApp, type TestApp } from '../helpers/test-app.js';
import { depsDePrueba } from './helpers.js';

let t: TestApp;
// Día 1 de un mes lejano: solo cuentan las actualizaciones que crea esta prueba.
const HOY = '2030-02-01';

beforeAll(async () => {
  t = await prepararApp();
  // Elena (8) tiene el resumen mensual: adopción activa de Greta (2) y pausada de Lupe (11).
  // Irene (10) pasa a resumen mensual con los emails desactivados; Sergio (9), a resumen sin novedades.
  await t.pool.query(
    "UPDATE users SET email_frequency = 'monthly_digest', email_notifications = (id <> 10) WHERE id IN (9, 10)",
  );
  await t.pool.query(
    `INSERT INTO animal_updates (animal_id, author_id, title, body, visibility, published_at) VALUES
       (2,  5, 'Greta en enero',      'Greta ha pasado un mes tranquilo en el voladero grande.', 'adopters', '2030-01-10T10:00:00+01:00'),
       (2,  5, 'Greta y la nieve',    'Ha nevado y Greta se ha quedado mirando los copos.',      'public',   '2030-01-25T10:00:00+01:00'),
       (2,  5, 'Greta en febrero',    'Fuera del mes.',                                          'adopters', '2030-02-01T00:30:00+01:00'),
       (2,  5, 'Greta en diciembre',  'Fuera del mes.',                                          'adopters', '2029-12-31T23:30:00+01:00'),
       (11, 3, 'Lupe en enero',       'Adopción pausada: no va en el resumen.',                  'adopters', '2030-01-12T10:00:00+01:00'),
       (3,  3, 'Turia en enero',      'Irene no quiere emails.',                                 'adopters', '2030-01-12T10:00:00+01:00')`,
  );
});
afterAll(() => t.pool.end());
beforeEach(() => {
  t.mailer.outbox.length = 0;
});

describe('CU-46 Enviar el resumen mensual (tarea monthly-digest)', () => {
  it('1-2: un email por adoptante con resumen y novedades del mes anterior, agrupadas por animal', async () => {
    expect(await runMonthlyDigest(depsDePrueba(t, { hoy: HOY }))).toEqual({ sent: 1, errors: 0 });
    expect(t.mailer.outbox.map((m) => m.to)).toEqual(['elena.rubio@correo.test']);
    const email = t.mailer.outbox[0]!;
    expect(email.subject).toBe('Novedades de enero de 2030');
    expect(email.text).toContain('Greta');
    expect(email.text.indexOf('Greta en enero')).toBeLessThan(email.text.indexOf('Greta y la nieve'));
    expect(email.text).not.toContain('Greta en febrero');
    expect(email.text).not.toContain('Greta en diciembre');
    expect(email.text).not.toContain('Lupe en enero');
    expect(email.html).toContain('/my-animals/2');
  });

  it('postcondición: como máximo un resumen al mes, aunque la tarea se ejecute otra vez', async () => {
    expect(await runMonthlyDigest(depsDePrueba(t, { hoy: HOY }))).toEqual({ sent: 0, errors: 0 });
    expect(t.mailer.outbox).toEqual([]);
  });

  it('si falla el envío no se marca como enviado y se reintenta en la siguiente ejecución', async () => {
    const errores: unknown[] = [];
    t.mailer.failNext = true;
    const marzo = '2030-03-01';
    await t.pool.query(
      "INSERT INTO animal_updates (animal_id, author_id, title, body, visibility, published_at) VALUES (2, 5, 'Greta en febrero 2', 'Texto.', 'adopters', '2030-02-15T10:00:00+01:00')",
    );
    expect(await runMonthlyDigest(depsDePrueba(t, { hoy: marzo, errores }))).toEqual({ sent: 0, errors: 1 });
    expect(errores).toHaveLength(1);
    expect(await runMonthlyDigest(depsDePrueba(t, { hoy: marzo }))).toEqual({ sent: 1, errors: 0 });
  });
});
