import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prepararApp, type TestApp } from './helpers/test-app.js';

let t: TestApp;
beforeAll(async () => {
  t = await prepararApp();
});
afterAll(() => t.pool.end());

const metodos = async (tabla: 'payments' | 'donations') =>
  (await t.pool.query<{ method: string }>(`SELECT DISTINCT method FROM ${tabla} ORDER BY method`)).rows.map(
    (r) => r.method,
  );

describe('Formas de pago en la base de datos: tarjeta y transferencia', () => {
  it('los datos de prueba solo usan tarjeta y transferencia, con referencias realistas', async () => {
    expect(await metodos('payments')).toEqual(['bank_transfer', 'card']);
    expect(await metodos('donations')).toEqual(['bank_transfer', 'card']);
    const { rows } = await t.pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM (
         SELECT payment_reference, failure_reason FROM payments
         UNION ALL SELECT payment_reference, failure_reason FROM donations) r
        WHERE payment_reference !~ '^(CARD|TRF)-' OR failure_reason ILIKE '%simula%'`,
    );
    expect(rows[0]!.n).toBe(0);
  });

  it('el CHECK rechaza el efectivo y el antiguo «simulated», y no hay valor por defecto', async () => {
    for (const metodo of ['cash', 'simulated']) {
      await expect(t.pool.query(`UPDATE payments SET method = $1 WHERE id = 1`, [metodo])).rejects.toMatchObject({
        code: '23514',
      });
      await expect(t.pool.query(`UPDATE donations SET method = $1 WHERE id = 1`, [metodo])).rejects.toMatchObject({
        code: '23514',
      });
    }
    const { rows } = await t.pool.query<{ table_name: string; column_default: string | null }>(
      `SELECT table_name, column_default FROM information_schema.columns
        WHERE column_name = 'method' AND table_name IN ('payments', 'donations') ORDER BY table_name`,
    );
    expect(rows).toEqual([
      { table_name: 'donations', column_default: null },
      { table_name: 'payments', column_default: null },
    ]);
  });
});
