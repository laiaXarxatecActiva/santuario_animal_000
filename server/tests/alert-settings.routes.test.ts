import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { entrarComo, type Agente } from './helpers/sesion.js';
import { prepararApp, type TestApp } from './helpers/test-app.js';

let t: TestApp;
let marta: Agente;
let nuria: Agente;
beforeAll(async () => {
  t = await prepararApp();
  marta = await entrarComo(t.app, 'marta');
  nuria = await entrarComo(t.app, 'nuria');
});
afterAll(() => t.pool.end());

describe('CU-73 y CU-74 Ajustes de los avisos por email y del resumen diario', () => {
  it('de entrada: todos los avisos por email salvo la visita de hoy, y el resumen desactivado a las 20:00', async () => {
    const res = await marta.get('/api/admin/alert-settings');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      emailAlertTypes: ['coverage_gap', 'low_intake', 'medication_missed', 'incident_reported'],
      dailySummaryEnabled: false,
      dailySummaryTime: '20:00',
      lowIntakeMeals: 2,
    });
  });

  it('el administrador los cambia y queda en el registro de actividad', async () => {
    const res = await marta.put('/api/admin/alert-settings').send({
      emailAlertTypes: ['incident_reported', 'vet_visit_today', 'incident_reported'],
      dailySummaryEnabled: true,
      dailySummaryTime: '19:30',
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      emailAlertTypes: ['vet_visit_today', 'incident_reported'],
      dailySummaryEnabled: true,
      dailySummaryTime: '19:30',
      lowIntakeMeals: 2,
    });
    expect((await marta.get('/api/admin/alert-settings')).body).toEqual(res.body);
    // Los otros ajustes no cambian.
    expect((await marta.get('/api/admin/work-settings')).body).toMatchObject({ lateMarginMinutes: 30 });
    const { rows } = await t.pool.query<{ details: Record<string, unknown> }>(
      "SELECT details FROM activity_logs WHERE table_name = 'work_settings' ORDER BY id DESC LIMIT 1",
    );
    expect(rows[0]?.details).toEqual({
      emailAlertTypes: [
        ['coverage_gap', 'low_intake', 'medication_missed', 'incident_reported'],
        ['vet_visit_today', 'incident_reported'],
      ],
      dailySummaryEnabled: [false, true],
      dailySummaryTime: ['20:00', '19:30'],
    });
  });

  it('CU-67: aquí se elige tras cuántas comidas seguidas comiendo poco se avisa; si no se envía, no cambia', async () => {
    const cuerpo = { emailAlertTypes: ['incident_reported'], dailySummaryEnabled: false, dailySummaryTime: '20:00' };
    const res = await marta.put('/api/admin/alert-settings').send({ ...cuerpo, lowIntakeMeals: 3 });
    expect(res.status).toBe(200);
    expect(res.body.lowIntakeMeals).toBe(3);
    const { rows } = await t.pool.query<{ details: Record<string, unknown> }>(
      "SELECT details FROM activity_logs WHERE table_name = 'work_settings' ORDER BY id DESC LIMIT 1",
    );
    expect(rows[0]?.details).toMatchObject({ lowIntakeMeals: [2, 3] });

    const sinCambio = await marta.put('/api/admin/alert-settings').send(cuerpo);
    expect(sinCambio.body.lowIntakeMeals).toBe(3);

    for (const fuera of [0, 11]) {
      const mal = await marta.put('/api/admin/alert-settings').send({ ...cuerpo, lowIntakeMeals: fuera });
      expect(mal.status).toBe(400);
      expect(mal.body.error.details).toEqual([{ field: 'lowIntakeMeals', message: 'De 1 a 10 comidas.' }]);
    }
  });

  it('valida los datos', async () => {
    const res = await marta
      .put('/api/admin/alert-settings')
      .send({ emailAlertTypes: ['nope'], dailySummaryEnabled: true, dailySummaryTime: '25:00' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { field: string }) => d.field).sort()).toEqual([
      'dailySummaryTime',
      'emailAlertTypes.0',
    ]);
  });

  it('solo el administrador', async () => {
    expect((await nuria.get('/api/admin/alert-settings')).status).toBe(403);
    expect((await nuria.put('/api/admin/alert-settings').send({})).status).toBe(403);
  });
});
