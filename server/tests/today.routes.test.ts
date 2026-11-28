import type { TodayDto } from '@sanctuary/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sumarDias } from '../src/dominio/tareas.js';
import { entrarComo, type Agente } from './helpers/sesion.js';
import { prepararApp, type TestApp } from './helpers/test-app.js';

// En TEST_DATA.sql, a las 13:00 de Madrid: la doxiciclina de Carbón de hoy
// (10:00) sigue pendiente y la de ayer no se dio; hay una incidencia abierta
// (1) y otra en curso (2, grave); Nuria y Andrés tienen turno de mañana sin
// fichar y Carmen, de tarde; Carbón comió poco esta mañana (1 toma).

let t: TestApp;
let marta: Agente;
let nuria: Agente;
beforeAll(async () => {
  t = await prepararApp();
  marta = await entrarComo(t.app, 'marta');
  nuria = await entrarComo(t.app, 'nuria');
});
afterAll(() => t.pool.end());

const hoy = async (): Promise<TodayDto> => {
  const res = await marta.get('/api/admin/today');
  expect(res.status).toBe(200);
  return res.body;
};

describe('CU-72 Panel «Hoy» del administrador', () => {
  it('solo el administrador', async () => {
    expect((await nuria.get('/api/admin/today')).status).toBe(403);
  });

  it('recuento de las tareas de hoy y las atrasadas y no realizadas', async () => {
    const panel = await hoy();
    expect(panel.date).toBe(t.hoy);
    const { total, completed, notDone, pending, late } = panel.tasks;
    expect(total).toBe(completed + notDone + pending);
    expect(late).toBe(panel.lateTasks.length);
    expect(late).toBeGreaterThan(0);
    expect(panel.lateTasks.every((x) => x.late && x.status === 'pending' && x.dueDate === t.hoy)).toBe(true);
    expect(panel.notDoneTasks.length).toBe(notDone);
    expect(panel.notDoneTasks.every((x) => x.status === 'not_done')).toBe(true);
  });

  it('las dosis de ayer y de hoy no dadas', async () => {
    const panel = await hoy();
    expect(panel.missedDoses.map((d) => [d.dueDate, d.title, d.status])).toEqual([
      [sumarDias(t.hoy, -1), 'Doxiciclina · 100 mg', 'not_done'],
      [t.hoy, 'Doxiciclina · 100 mg', 'pending'],
    ]);
  });

  it('las incidencias abiertas y en curso, las graves primero', async () => {
    const panel = await hoy();
    expect(panel.incidents.open).toBe(1);
    expect(panel.incidents.inProgress).toBe(1);
    expect(panel.incidents.latest.map((i) => i.id)).toEqual([2, 1]);
  });

  it('los turnos de hoy, con quién no ha fichado la entrada', async () => {
    const panel = await hoy();
    const porPersona = Object.fromEntries(
      panel.shifts.map((s) => [s.assignment.user.name, [s.assignment.shift.name, s.missingCheckIn]]),
    );
    expect(porPersona['Nuria Peris Gil']).toEqual(['Mañana', true]);
    expect(porPersona['Carmen Boix Vidal']).toEqual(['Tarde', false]);
    expect(panel.gaps.every((g) => g.date === t.hoy)).toBe(true);
  });

  it('los animales que comen poco según los ajustes y las visitas de hoy', async () => {
    expect((await hoy()).lowIntake).toEqual([]);
    await marta.put('/api/admin/alert-settings').send({
      emailAlertTypes: [],
      dailySummaryEnabled: false,
      dailySummaryTime: '20:00',
      lowIntakeMeals: 1,
    });
    expect((await hoy()).lowIntake).toEqual([{ animal: { id: 10, name: 'Carbón' }, streak: 1 }]);

    expect((await hoy()).vetVisits).toEqual([]);
    await t.pool.query('UPDATE vet_visits SET visit_date = CURRENT_DATE WHERE id = 1');
    expect((await hoy()).vetVisits).toEqual([
      expect.objectContaining({ id: 1, animal: { id: 14, name: 'Pipa' }, time: '11:00', status: 'scheduled' }),
    ]);
  });
});
