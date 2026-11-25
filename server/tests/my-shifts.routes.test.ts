import type { MyShiftsDto } from '@sanctuary/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sumarDias } from '../src/dominio/tareas.js';
import { entrarComo, type Agente } from './helpers/sesion.js';
import { prepararApp, type TestApp } from './helpers/test-app.js';

let t: TestApp;
let nuria: Agente;
beforeAll(async () => {
  t = await prepararApp();
  nuria = await entrarComo(t.app, 'nuria');
});
afterAll(() => t.pool.end());

const fichajes = async (agente: Agente, query: Record<string, string> = {}) => {
  const res = await agente.get('/api/admin/my-shifts').query(query);
  expect(res.status).toBe(200);
  return res.body as MyShiftsDto;
};

describe('CU-63 Mis fichajes', () => {
  it('por defecto, las últimas 4 semanas hasta hoy, del más reciente al más antiguo', async () => {
    const res = await fichajes(nuria);
    expect(res.from).toBe(sumarDias(t.hoy, -27));
    expect(res.to).toBe(t.hoy);
    // TEST_DATA: Nuria tiene la mañana desde hace 7 días; las pasadas, fichadas 2 min antes y 5 después.
    expect(res.data.map((a) => a.date)).toEqual([0, 1, 2, 3, 4, 5, 6, 7].map((d) => sumarDias(t.hoy, -d)));
    expect(res.data[0]).toMatchObject({
      shift: { id: 1, name: 'Mañana', startTime: '07:00', endTime: '15:00' },
      user: { id: 3 },
      checkedInAt: null,
      checkedOutAt: null,
      workedMinutes: null,
    });
    expect(res.data[1]).toMatchObject({ checkedInAt: expect.any(String), workedMinutes: 487 });
    expect(res.totalWorkedMinutes).toBe(7 * 487);
  });

  it('solo los suyos: cada persona ve sus fichajes y el administrador sin turnos, ninguno', async () => {
    const andres = await fichajes(await entrarComo(t.app, 'andres'));
    expect(andres.data.length).toBeGreaterThan(0);
    expect(new Set(andres.data.map((a) => a.user.id))).toEqual(new Set([4]));
    const marta = await fichajes(await entrarComo(t.app, 'marta'));
    expect(marta).toMatchObject({ data: [], totalWorkedMinutes: 0 });
  });

  it('con «desde» y «hasta», solo esos días (también los próximos, aún sin fichar)', async () => {
    const res = await fichajes(nuria, { from: sumarDias(t.hoy, -2), to: sumarDias(t.hoy, 1) });
    expect(res.data.map((a) => a.date)).toEqual([1, 0, -1, -2].map((d) => sumarDias(t.hoy, d)));
    expect(res.totalWorkedMinutes).toBe(2 * 487);
  });

  it('valida las fechas: fin anterior al inicio o más de 92 días', async () => {
    const alReves = await nuria.get('/api/admin/my-shifts').query({ from: t.hoy, to: sumarDias(t.hoy, -1) });
    expect(alReves.status).toBe(400);
    const largo = await nuria.get('/api/admin/my-shifts').query({ from: sumarDias(t.hoy, -92), to: t.hoy });
    expect(largo.status).toBe(400);
    expect((await nuria.get('/api/admin/my-shifts').query({ from: 'ayer' })).status).toBe(400);
  });
});
