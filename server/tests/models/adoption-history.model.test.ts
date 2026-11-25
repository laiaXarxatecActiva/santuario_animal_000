import { beforeEach, describe, expect, it } from 'vitest';
import { countHistory, listHistory } from '../../src/models/adoption-history.model.js';
import { usarBaseDeDatos } from '../helpers/db-fixture.js';

const db = usarBaseDeDatos();

// Lucía (usuaria 6 de TEST_DATA.sql): adopciones 1 (Rufo, activa desde hace 14 meses),
// 2 (activa, 6 meses), 18 (activa, 20 días) y 3 (terminada hace 20 días: el animal murió).
const LUCIA = 6;

const sucesos = async (adoptionId: number) => {
  const { rows } = await db.pool.query<{
    type: string;
    from_plan_id: number | null;
    to_plan_id: number | null;
    payment_mode: string | null;
  }>('SELECT type, from_plan_id, to_plan_id, payment_mode FROM adoption_events WHERE adoption_id = $1 ORDER BY id', [
    adoptionId,
  ]);
  return rows;
};

const hoyMenos = async (intervalo: string) => {
  const { rows } = await db.pool.query<{ d: string }>(`SELECT (CURRENT_DATE - $1::interval)::date::text AS d`, [
    intervalo,
  ]);
  return rows[0]!.d;
};

describe('CU-15 adoption_events: el trigger apunta lo que no queda guardado en la adopción', () => {
  beforeEach(async () => {
    await db.pool.query('DELETE FROM adoption_events WHERE adoption_id = 1');
  });

  it('CU-20: pedir un cambio de plan, anularlo y volver a pedirlo', async () => {
    await db.pool.query('UPDATE adoptions SET next_plan_id = 3 WHERE id = 1');
    await db.pool.query('UPDATE adoptions SET next_plan_id = NULL WHERE id = 1');
    expect(await sucesos(1)).toEqual([
      { type: 'plan_change_requested', from_plan_id: 2, to_plan_id: 3, payment_mode: null },
      { type: 'plan_change_cancelled', from_plan_id: 3, to_plan_id: 2, payment_mode: null },
    ]);
  });

  it('CU-43: al aplicarse el cambio en la cuota, solo se apunta el cambio de plan', async () => {
    await db.pool.query('UPDATE adoptions SET next_plan_id = 1 WHERE id = 1');
    await db.pool.query('UPDATE adoptions SET plan_id = next_plan_id, next_plan_id = NULL WHERE id = 1');
    expect((await sucesos(1)).map((s) => [s.type, s.from_plan_id, s.to_plan_id])).toEqual([
      ['plan_change_requested', 2, 1],
      ['plan_changed', 2, 1],
    ]);
    await db.pool.query('UPDATE adoptions SET plan_id = 2 WHERE id = 1');
  });

  it('CU-49: el cambio de forma de pago guarda la nueva', async () => {
    await db.pool.query("UPDATE adoptions SET payment_mode = 'manual' WHERE id = 1");
    await db.pool.query("UPDATE adoptions SET payment_mode = 'manual' WHERE id = 1");
    expect(await sucesos(1)).toEqual([
      { type: 'payment_mode_changed', from_plan_id: null, to_plan_id: null, payment_mode: 'manual' },
    ]);
    await db.pool.query("UPDATE adoptions SET payment_mode = 'automatic' WHERE id = 1");
  });

  it('se pausa y se reanuda', async () => {
    await db.pool.query("UPDATE adoptions SET status = 'paused' WHERE id = 1");
    await db.pool.query("UPDATE adoptions SET status = 'active' WHERE id = 1");
    expect((await sucesos(1)).map((s) => s.type)).toEqual(['paused', 'resumed']);
  });

  it('CU-21: la baja borra el cambio programado sin apuntar que se anuló', async () => {
    await db.pool.query('UPDATE adoptions SET next_plan_id = 3 WHERE id = 1');
    await db.pool.query(
      `UPDATE adoptions SET cancel_requested_at = NOW(), end_date = next_billing_date - 1,
              next_billing_date = NULL, next_plan_id = NULL WHERE id = 1`,
    );
    expect((await sucesos(1)).map((s) => s.type)).toEqual(['plan_change_requested']);
  });

  it('cambiar otras columnas no apunta nada', async () => {
    await db.pool.query("UPDATE adoptions SET notes = 'Nota interna' WHERE id = 1");
    expect(await sucesos(1)).toEqual([]);
  });
});

describe('CU-15 listHistory: el historial del adoptante', () => {
  it('junta adopciones, pagos y sucesos guardados, del más reciente al más antiguo', async () => {
    const desde = await hoyMenos('1 year');
    const total = await countHistory(db.pool, LUCIA, { since: desde });
    const lista = await listHistory(db.pool, LUCIA, { since: desde }, { limit: 100, offset: 0 });
    expect(lista).toHaveLength(total);
    expect(total).toBeGreaterThan(5);

    const fechas = lista.map((s) => s.date);
    expect([...fechas].sort().reverse()).toEqual(fechas);
    expect(fechas.every((f) => f >= desde)).toBe(true);
    expect(new Set(lista.map((s) => s.id)).size).toBe(lista.length);

    // Adopción 18: empezó hace 20 días con el plan Simbólica y pagó su primera cuota.
    const adopcion18 = lista.filter((s) => s.animal.id === 10);
    expect(adopcion18.find((s) => s.type === 'adopted')).toMatchObject({
      date: await hoyMenos('20 days'),
      planName: 'Simbólica',
    });
    expect(adopcion18.find((s) => s.type === 'payment_completed')).toMatchObject({
      amount: '1.00',
      periodStart: await hoyMenos('20 days'),
    });

    // Adopción 3: terminó hace 20 días porque el animal murió.
    expect(lista.find((s) => s.type === 'ended')).toMatchObject({
      animal: { id: 12 },
      date: await hoyMenos('20 days'),
      endStatus: 'finished',
      endReason: 'animal_deceased',
    });

    // La adopción de Rufo empezó hace más de un año: no sale, pero sí sus cuotas recientes.
    const rufo = lista.filter((s) => s.animal.id === 1);
    expect(rufo.some((s) => s.type === 'adopted')).toBe(false);
    expect(rufo.some((s) => s.type === 'payment_completed')).toBe(true);
  });

  it('solo trae lo del propio adoptante', async () => {
    const desde = await hoyMenos('1 year');
    const lista = await listHistory(db.pool, LUCIA, { since: desde }, { limit: 100, offset: 0 });
    const { rows } = await db.pool.query<{ animal_id: number }>('SELECT animal_id FROM adoptions WHERE user_id = $1', [
      LUCIA,
    ]);
    const suyos = new Set(rows.map((r) => r.animal_id));
    expect(lista.every((s) => suyos.has(s.animal.id))).toBe(true);
  });

  it('filtra por animal y pagina', async () => {
    const desde = await hoyMenos('1 year');
    const deRufo = await countHistory(db.pool, LUCIA, { since: desde, animalId: 1 });
    const lista = await listHistory(db.pool, LUCIA, { since: desde, animalId: 1 }, { limit: 3, offset: 0 });
    expect(lista).toHaveLength(Math.min(3, deRufo));
    expect(lista.every((s) => s.animal.id === 1)).toBe(true);
    const siguiente = await listHistory(db.pool, LUCIA, { since: desde, animalId: 1 }, { limit: 3, offset: 3 });
    expect(siguiente.map((s) => s.id)).not.toContain(lista[0]!.id);
  });

  it('las cuotas fallidas y devueltas también salen, y los cambios de plan con sus nombres', async () => {
    const desde = await hoyMenos('1 year');
    // Pablo (7): cuota devuelta de la adopción 20 y cambio de plan programado en la 5.
    await db.pool.query('UPDATE adoptions SET next_plan_id = NULL WHERE id = 5');
    await db.pool.query('UPDATE adoptions SET next_plan_id = 3 WHERE id = 5');
    const pablo = await listHistory(db.pool, 7, { since: desde }, { limit: 100, offset: 0 });
    expect(pablo.find((s) => s.type === 'payment_refunded')).toMatchObject({ amount: '5.00' });
    expect(pablo.find((s) => s.type === 'plan_change_requested')).toMatchObject({
      previousPlanName: 'Usual',
      planName: 'Extraordinaria',
    });
    // Elena (8): la cuota fallida de la adopción 7.
    const elena = await listHistory(db.pool, 8, { since: desde }, { limit: 100, offset: 0 });
    expect(elena.find((s) => s.type === 'payment_failed')).toMatchObject({ amount: '5.00' });
  });

  it('CU-21: la baja pedida sale; una baja que cierra la adopción el mismo día, solo como cierre', async () => {
    const desde = await hoyMenos('1 year');
    // Sergio (9): pidió la baja de la adopción 9 hace 5 días y sigue activa hasta fin de mes.
    const sergio = await listHistory(db.pool, 9, { since: desde }, { limit: 100, offset: 0 });
    expect(sergio.find((s) => s.type === 'cancel_requested')).toMatchObject({ date: await hoyMenos('5 days') });
    expect(sergio.some((s) => s.type === 'ended')).toBe(false);
  });

  it('CU-21: la baja de una pendiente la cierra en el acto: solo sale el cierre', async () => {
    const desde = await hoyMenos('1 year');
    // Usuario 10: adopción 11, pendiente de pago desde hace 2 días.
    await db.pool.query(
      `UPDATE adoptions SET status = 'cancelled', end_reason = 'user_cancelled', end_date = CURRENT_DATE,
              cancel_requested_at = NOW() WHERE id = 11`,
    );
    const lista = await listHistory(db.pool, 10, { since: desde }, { limit: 100, offset: 0 });
    const deLaOnce = lista.filter((s) => s.animal.id === 5).map((s) => s.type);
    expect(deLaOnce).toContain('ended');
    expect(deLaOnce).not.toContain('cancel_requested');
    expect(lista.find((s) => s.type === 'ended' && s.animal.id === 5)).toMatchObject({
      endStatus: 'cancelled',
      endReason: 'user_cancelled',
    });
  });
});
