import type { AdminStatsDto } from '@sanctuary/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { entrarComo, type Agente } from './helpers/sesion.js';
import { prepararApp, type TestApp } from './helpers/test-app.js';

let t: TestApp;
let marta: Agente;
beforeAll(async () => {
  t = await prepararApp();
  marta = await entrarComo(t.app, 'marta');
});
afterAll(() => t.pool.end());

const stats = async (query = ''): Promise<AdminStatsDto> => {
  const res = await marta.get(`/api/admin/stats${query}`);
  expect(res.status).toBe(200);
  return res.body;
};

const MADRID = "AT TIME ZONE 'Europe/Madrid'";

describe('CU-41 Consultar estadísticas', () => {
  it('solo el administrador: la cuidadora recibe 403 y sin sesión 401', async () => {
    const nuria = await entrarComo(t.app, 'nuria');
    expect((await nuria.get('/api/admin/stats')).status).toBe(403);
    expect((await request(t.app).get('/api/admin/stats')).status).toBe(401);
  });

  it('2: por defecto, los últimos 12 meses con todos los meses (también los que están a 0)', async () => {
    const s = await stats();
    const mesActual = t.hoy.slice(0, 7);
    expect(s.range.to).toBe(mesActual);
    expect(s.revenueByMonth).toHaveLength(12);
    expect(s.adoptionsByMonth).toHaveLength(12);
    expect(s.revenueByMonth.at(-1)!.month).toBe(mesActual);
    expect(s.revenueByMonth[0]!.month).toBe(s.range.from);
  });

  it('3: ingresos por mes con cuotas y donaciones por separado (solo lo cobrado), como en el escritorio', async () => {
    const s = await stats();
    const { rows } = await t.pool.query<{ month: string; fees: string; donations: string }>(
      `SELECT to_char(paid_at ${MADRID}, 'YYYY-MM') AS month,
              COALESCE(sum(amount) FILTER (WHERE tipo = 'fee'), 0)::numeric(12,2)::text AS fees,
              COALESCE(sum(amount) FILTER (WHERE tipo = 'donation'), 0)::numeric(12,2)::text AS donations
         FROM (SELECT 'fee' AS tipo, amount, paid_at FROM payments WHERE status = 'completed'
               UNION ALL SELECT 'donation', amount, paid_at FROM donations WHERE status = 'completed') c
        GROUP BY 1`,
    );
    const esperado = new Map(rows.map((r) => [r.month, r]));
    for (const mes of s.revenueByMonth) {
      expect(mes.fees).toBe(esperado.get(mes.month)?.fees ?? '0.00');
      expect(mes.donations).toBe(esperado.get(mes.month)?.donations ?? '0.00');
    }
    // El mes actual coincide con los ingresos del escritorio (CU-27).
    const escritorio = (await marta.get('/api/admin/dashboard')).body.revenue;
    expect(s.revenueByMonth.at(-1)).toMatchObject({ fees: escritorio.fees, donations: escritorio.donations });
    expect(s.revenueByMonth.some((m) => m.fees !== '0.00')).toBe(true);
  });

  it('3: adopciones nuevas (inicio) y bajas (cierre de las que llegaron a empezar) por mes', async () => {
    const s = await stats();
    const altas = await t.pool.query<{ month: string; n: number }>(
      "SELECT to_char(start_date, 'YYYY-MM') AS month, count(*)::int AS n FROM adoptions WHERE start_date IS NOT NULL GROUP BY 1",
    );
    const bajas = await t.pool.query<{ month: string; n: number }>(
      `SELECT to_char(end_date, 'YYYY-MM') AS month, count(*)::int AS n FROM adoptions
        WHERE status IN ('cancelled', 'finished') AND start_date IS NOT NULL AND end_date IS NOT NULL GROUP BY 1`,
    );
    const a = new Map(altas.rows.map((r) => [r.month, r.n]));
    const b = new Map(bajas.rows.map((r) => [r.month, r.n]));
    for (const mes of s.adoptionsByMonth) {
      expect(mes.started).toBe(a.get(mes.month) ?? 0);
      expect(mes.ended).toBe(b.get(mes.month) ?? 0);
    }
    expect(s.adoptionsByMonth.some((m) => m.started > 0)).toBe(true);
  });

  it('3: animales más adoptados (adopciones activas), de más a menos y como mucho 5', async () => {
    const s = await stats();
    const { rows } = await t.pool.query<{ animal_id: number; n: number }>(
      "SELECT animal_id, count(*)::int AS n FROM adoptions WHERE status = 'active' GROUP BY animal_id",
    );
    const activas = new Map(rows.map((r) => [r.animal_id, r.n]));
    expect(s.mostAdopted.length).toBeGreaterThan(0);
    expect(s.mostAdopted.length).toBeLessThanOrEqual(5);
    for (const fila of s.mostAdopted) expect(fila.activeAdoptions).toBe(activas.get(fila.animal.id));
    const cifras = s.mostAdopted.map((f) => f.activeAdoptions);
    expect(cifras).toEqual([...cifras].sort((x, y) => y - x));
    expect(cifras[0]).toBe(Math.max(...activas.values()));
  });

  it('3: animales sin adoptantes: en el santuario o en tratamiento y sin adopciones activas', async () => {
    const s = await stats();
    const { rows } = await t.pool.query<{ id: number }>(
      `SELECT a.id FROM animals a
        WHERE a.status IN ('in_sanctuary', 'in_treatment')
          AND NOT EXISTS (SELECT 1 FROM adoptions ad WHERE ad.animal_id = a.id AND ad.status = 'active')`,
    );
    expect(s.withoutAdopters.map((a) => a.id).sort((x, y) => x - y)).toEqual(
      rows.map((r) => r.id).sort((x, y) => x - y),
    );
    expect(s.withoutAdopters.every((a) => typeof a.species === 'string')).toBe(true);
  });

  it('3: reparto de las adopciones activas por plan', async () => {
    const s = await stats();
    const { rows } = await t.pool.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM adoptions WHERE status = 'active'",
    );
    expect(s.activeByPlan.reduce((suma, p) => suma + p.count, 0)).toBe(rows[0]!.n);
    expect(s.activeByPlan.every((p) => p.plan.name.length > 0)).toBe(true);
  });

  it('2: con un rango elegido, solo esos meses', async () => {
    const s = await stats('?from=2026-01-10&to=2026-03-20');
    expect(s.range).toEqual({ from: '2026-01', to: '2026-03' });
    expect(s.revenueByMonth.map((m) => m.month)).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(s.adoptionsByMonth.map((m) => m.month)).toEqual(['2026-01', '2026-02', '2026-03']);
  });

  it('3a: un rango sin datos devuelve los meses a 0', async () => {
    const s = await stats('?from=2001-01-01&to=2001-02-28');
    expect(s.revenueByMonth).toEqual([
      { month: '2001-01', fees: '0.00', donations: '0.00' },
      { month: '2001-02', fees: '0.00', donations: '0.00' },
    ]);
    expect(s.adoptionsByMonth.every((m) => m.started === 0 && m.ended === 0)).toBe(true);
  });

  it('un rango al revés o de más de 60 meses es un error en el campo', async () => {
    const reves = await marta.get('/api/admin/stats?from=2026-05-01&to=2026-01-01');
    expect(reves.status).toBe(400);
    expect(reves.body.error.details[0].field).toBe('to');
    const largo = await marta.get('/api/admin/stats?from=2020-01-01&to=2026-01-31');
    expect(largo.status).toBe(400);
    expect(largo.body.error.details).toEqual([{ field: 'from', message: 'El rango no puede superar los 60 meses.' }]);
  });
});
