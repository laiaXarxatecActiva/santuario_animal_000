import type { AbsenceCreatedDto, AbsenceDto } from '@sanctuary/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sumarDias } from '../src/dominio/tareas.js';
import { entrarComo, type Agente } from './helpers/sesion.js';
import { prepararApp, type TestApp } from './helpers/test-app.js';

let t: TestApp;
let marta: Agente;
let nuria: Agente;
let lucia: Agente;
beforeAll(async () => {
  t = await prepararApp();
  marta = await entrarComo(t.app, 'marta');
  nuria = await entrarComo(t.app, 'nuria');
  lucia = await entrarComo(t.app, 'lucia');
});
afterAll(() => t.pool.end());

const turnosDeNuria = async (desde: string, hasta: string): Promise<string[]> =>
  (
    await t.pool.query<{ d: string }>(
      "SELECT to_char(shift_date, 'YYYY-MM-DD') AS d FROM shift_assignments WHERE user_id = 3 AND shift_date BETWEEN $1 AND $2 ORDER BY 1",
      [desde, hasta],
    )
  ).rows.map((r) => r.d);

describe('CU-62 Registrar ausencias', () => {
  it('solo el administrador las consulta y las registra', async () => {
    expect((await request(t.app).get('/api/admin/absences')).status).toBe(401);
    expect((await lucia.get('/api/admin/absences')).status).toBe(403);
    expect((await nuria.get('/api/admin/absences')).status).toBe(403);
    expect(
      (await nuria.post('/api/admin/absences').send({ userId: 3, startDate: t.hoy, endDate: t.hoy, type: 'other' }))
        .status,
    ).toBe(403);
  });

  it('1: lista las ausencias del rango, con el motivo', async () => {
    const res = await marta.get('/api/admin/absences').query({ from: sumarDias(t.hoy, -10), to: sumarDias(t.hoy, 10) });
    expect(res.status).toBe(200);
    const ausencias: AbsenceDto[] = res.body.data;
    expect(ausencias.map((a) => [a.user.name, a.type])).toEqual([
      ['Andrés Climent Mas', 'sick_leave'],
      ['Carmen Boix Vidal', 'vacation'],
    ]);
  });

  it('2-3: al registrarla, quita los turnos de esos días y dice cuáles; los ya fichados se quedan', async () => {
    // Nuria ficha hoy y después se pone enferma desde hoy hasta pasado mañana.
    const { rows } = await t.pool.query<{ id: number }>(
      'SELECT id FROM shift_assignments WHERE user_id = 3 AND shift_date = $1',
      [t.hoy],
    );
    expect((await nuria.post(`/api/admin/shift-assignments/${rows[0]!.id}/check-in`).send({})).status).toBe(200);

    const res = await marta.post('/api/admin/absences').send({
      userId: 3,
      startDate: t.hoy,
      endDate: sumarDias(t.hoy, 2),
      type: 'sick_leave',
      notes: 'Fiebre.',
    });
    expect(res.status).toBe(201);
    const creada: AbsenceCreatedDto = res.body;
    expect(creada.absence).toMatchObject({
      user: { id: 3, name: 'Nuria Peris Gil' },
      startDate: t.hoy,
      endDate: sumarDias(t.hoy, 2),
      type: 'sick_leave',
      notes: 'Fiebre.',
    });
    expect(creada.removedAssignments.map((a) => [a.date, a.shift.name])).toEqual([
      [sumarDias(t.hoy, 1), 'Mañana'],
      [sumarDias(t.hoy, 2), 'Mañana'],
    ]);
    expect(creada.keptAssignments.map((a) => a.date)).toEqual([t.hoy]);
    expect(await turnosDeNuria(t.hoy, sumarDias(t.hoy, 3))).toEqual([t.hoy, sumarDias(t.hoy, 3)]);

    const log = await t.pool.query("SELECT action FROM activity_logs WHERE table_name = 'absences'");
    expect(log.rows).toEqual([{ action: 'create' }]);
  });

  it('2a: no se solapa con otra de la misma persona; las fechas y la persona se comprueban', async () => {
    const registrar = (datos: object) =>
      marta
        .post('/api/admin/absences')
        .send({ userId: 3, startDate: sumarDias(t.hoy, 2), endDate: sumarDias(t.hoy, 5), type: 'vacation', ...datos });
    expect((await registrar({})).body.error.details).toEqual([
      { field: 'startDate', message: 'Ya tiene una ausencia en esas fechas.' },
    ]);
    expect((await registrar({ userId: 6 })).body.error.details).toEqual([
      { field: 'userId', message: 'Elige a un trabajador.' },
    ]);
    expect(
      (await registrar({ startDate: sumarDias(t.hoy, 9), endDate: sumarDias(t.hoy, 8) })).body.error.details,
    ).toEqual([{ field: 'endDate', message: 'El último día no puede ser anterior al primero.' }]);
  });

  it('A1: se borra una ausencia; los turnos quitados no vuelven', async () => {
    const { rows } = await t.pool.query<{ id: number }>('SELECT id FROM absences WHERE user_id = 3');
    expect((await nuria.delete(`/api/admin/absences/${rows[0]!.id}`).send({})).status).toBe(403);
    expect((await marta.delete(`/api/admin/absences/${rows[0]!.id}`).send({})).status).toBe(204);
    expect((await marta.delete(`/api/admin/absences/${rows[0]!.id}`).send({})).status).toBe(404);
    expect(await turnosDeNuria(sumarDias(t.hoy, 1), sumarDias(t.hoy, 2))).toEqual([]);
  });
});
