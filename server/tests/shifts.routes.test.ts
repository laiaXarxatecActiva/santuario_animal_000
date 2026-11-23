import type { CopyWeekResultDto, ShiftAssignmentDto, ShiftsCalendarDto, ShiftTemplateDto } from '@sanctuary/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { diaDeLaSemana, sumarDias } from '../src/dominio/tareas.js';
import { lunesDe } from '../src/dominio/turnos.js';
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

/** Días de hoy a dentro de 6. */
const semana = () => Array.from({ length: 7 }, (_, i) => sumarDias(t.hoy, i));
/** El domingo de los próximos 7 días (hoy incluido). */
const domingo = () => semana().find((d) => diaDeLaSemana(d) === 7)!;
/** Un día de los próximos 6 (sin hoy) que no es domingo: Andrés tiene la mañana. */
const diaConAndres = () => semana().find((d) => d !== t.hoy && diaDeLaSemana(d) !== 7)!;

const calendario = async (agente: Agente, from = t.hoy, to = sumarDias(t.hoy, 6)): Promise<ShiftsCalendarDto> => {
  const res = await agente.get('/api/admin/shifts').query({ from, to });
  expect(res.status).toBe(200);
  return res.body;
};

const actividad = async (tabla: string) =>
  (await t.pool.query('SELECT action, record_id FROM activity_logs WHERE table_name = $1', [tabla])).rows;

describe('CU-60 Gestionar plantillas de turno', () => {
  it('las ve todo el personal, ordenadas por la hora de inicio, con lo que necesita cada zona', async () => {
    expect((await request(t.app).get('/api/admin/shift-templates')).status).toBe(401);
    expect((await lucia.get('/api/admin/shift-templates')).status).toBe(403);
    const res = await nuria.get('/api/admin/shift-templates');
    expect(res.status).toBe(200);
    const turnos: ShiftTemplateDto[] = res.body.data;
    expect(turnos.map((x) => x.name)).toEqual(['Mañana', 'Mantenimiento', 'Tarde']);
    expect(turnos[0]).toMatchObject({
      startTime: '07:00',
      endTime: '15:00',
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      isActive: true,
      hasAssignments: true,
      requirements: [
        { zone: { id: 4, name: 'Clínica y recuperación' }, minWorkers: 1 },
        { zone: { id: 5, name: 'Cocina y almacén' }, minWorkers: 1 },
        { zone: { id: 1, name: 'Gran voladero' }, minWorkers: 1 },
      ],
    });
    expect(turnos[1]).toMatchObject({ weekdays: [1, 2, 3, 4, 5], requirements: [], hasAssignments: false });
  });

  it('solo el administrador crea, edita y borra; los errores van a su campo', async () => {
    const cuerpo = {
      name: 'Noche',
      startTime: '22:00',
      endTime: '23:30',
      weekdays: [5, 6],
      requirements: [{ zoneId: 4, minWorkers: 1 }],
    };
    expect((await nuria.post('/api/admin/shift-templates').send(cuerpo)).status).toBe(403);
    const creado = await marta.post('/api/admin/shift-templates').send(cuerpo);
    expect(creado.status).toBe(201);
    expect(creado.body).toMatchObject({ name: 'Noche', weekdays: [5, 6], hasAssignments: false });

    const repetido = await marta.post('/api/admin/shift-templates').send({ ...cuerpo, name: 'noche' });
    expect(repetido.status).toBe(409);
    expect(repetido.body.error.code).toBe('SHIFT_TEMPLATE_NAME_TAKEN');

    const mal = await marta.post('/api/admin/shift-templates').send({ ...cuerpo, name: 'X', endTime: '21:00' });
    expect(mal.status).toBe(400);
    expect(mal.body.error.details).toEqual([
      { field: 'endTime', message: 'La hora de fin debe ser posterior a la de inicio.' },
    ]);

    const zona = await marta
      .post('/api/admin/shift-templates')
      .send({ ...cuerpo, name: 'Y', requirements: [{ zoneId: 999, minWorkers: 1 }] });
    expect(zona.status).toBe(400);
    expect(zona.body.error.details).toEqual([
      { field: 'requirements', message: 'Esta zona no existe o está desactivada.' },
    ]);

    const editado = await marta
      .put(`/api/admin/shift-templates/${creado.body.id}`)
      .send({ ...cuerpo, requirements: [], isActive: false });
    expect(editado.status).toBe(200);
    expect(editado.body).toMatchObject({ requirements: [], isActive: false });

    expect((await marta.delete(`/api/admin/shift-templates/${creado.body.id}`).send({})).status).toBe(204);
    expect((await actividad('shift_templates')).map((r) => r.action)).toEqual(['create', 'update', 'delete']);
  });

  it('A1: un turno con personas asignadas no se borra (se desactiva)', async () => {
    const res = await marta.delete('/api/admin/shift-templates/1').send({});
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SHIFT_TEMPLATE_IN_USE');
  });
});

describe('CU-61 Calendario de turnos', () => {
  it('todo el personal ve quién está en cada turno, las ausencias y los huecos', async () => {
    const cal = await calendario(nuria);
    expect(cal.from).toBe(t.hoy);
    expect(cal.shifts.map((s) => s.name)).toEqual(['Mañana', 'Mantenimiento', 'Tarde']);
    const deNuria = cal.assignments.filter((a) => a.user.id === 3);
    expect(deNuria).toHaveLength(7);
    expect(deNuria[0]).toMatchObject({
      shift: { id: 1, name: 'Mañana', startTime: '07:00', endTime: '15:00' },
      date: t.hoy,
      user: { id: 3, name: 'Nuria Peris Gil' },
      zones: [
        { id: 4, name: 'Clínica y recuperación' },
        { id: 3, name: 'Voladero de alimoches' },
      ],
      checkedInAt: null,
    });
    // Carmen está de vacaciones dentro de 3 y 4 días: esas tardes no tiene turno.
    const deCarmen = cal.assignments.filter((a) => a.user.id === 5).map((a) => a.date);
    expect(deCarmen).not.toContain(sumarDias(t.hoy, 3));
    expect(deCarmen).toHaveLength(5);
  });

  it('huecos: el domingo por la mañana (Andrés libra) y las tardes de las vacaciones de Carmen', async () => {
    const { gaps } = await calendario(marta);
    const resumen = gaps.map((g) => [g.date, g.shift.name, g.zone.name, g.required, g.assigned]);
    expect(resumen).toEqual(
      [
        [domingo(), 'Mañana', 'Cocina y almacén', 1, 0],
        [domingo(), 'Mañana', 'Gran voladero', 1, 0],
        [sumarDias(t.hoy, 3), 'Tarde', 'Clínica y recuperación', 1, 0],
        [sumarDias(t.hoy, 3), 'Tarde', 'Gran voladero', 1, 0],
        [sumarDias(t.hoy, 4), 'Tarde', 'Clínica y recuperación', 1, 0],
        [sumarDias(t.hoy, 4), 'Tarde', 'Gran voladero', 1, 0],
      ].sort((a, b) => String(a[0]).localeCompare(String(b[0])) || String(a[1]).localeCompare(String(b[1]))),
    );
  });

  it('CU-62: el cuidador ve que un compañero está ausente, pero no el motivo; el administrador, sí', async () => {
    const vacaciones = { user: { id: 5, name: 'Carmen Boix Vidal' }, startDate: sumarDias(t.hoy, 3) };
    expect((await calendario(nuria)).absences).toEqual([
      expect.objectContaining({ ...vacaciones, type: null, notes: null }),
    ]);
    expect((await calendario(marta)).absences).toEqual([expect.objectContaining({ ...vacaciones, type: 'vacation' })]);
  });

  it('el rango es de como mucho 31 días', async () => {
    const res = await nuria.get('/api/admin/shifts').query({ from: t.hoy, to: sumarDias(t.hoy, 31) });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field: 'to', message: 'Como máximo 31 días.' }]);
  });
});

describe('CU-61 Asignar turnos', () => {
  let creada: ShiftAssignmentDto;

  it('el administrador asigna a una persona; sin zonas, las que necesita el turno', async () => {
    const cuerpo = { shiftTemplateId: 2, date: domingo(), userId: 4, zoneIds: [] };
    expect((await nuria.post('/api/admin/shift-assignments').send(cuerpo)).status).toBe(403);
    const res = await marta.post('/api/admin/shift-assignments').send(cuerpo);
    expect(res.status).toBe(201);
    creada = res.body;
    expect(creada).toMatchObject({
      shift: { id: 2, name: 'Tarde' },
      date: domingo(),
      user: { id: 4 },
      zones: [
        { id: 4, name: 'Clínica y recuperación' },
        { id: 1, name: 'Gran voladero' },
      ],
    });
    expect(await actividad('shift_assignments')).toEqual([{ action: 'create', record_id: creada.id }]);
  });

  it('2a: comprueba la persona, el día y las zonas', async () => {
    const asignar = (datos: object) =>
      marta
        .post('/api/admin/shift-assignments')
        .send({ shiftTemplateId: 2, date: diaConAndres(), userId: 4, zoneIds: [], ...datos });
    const detalles = async (datos: object) => (await asignar(datos)).body.error.details;

    expect(await detalles({})).toEqual([
      { field: 'userId', message: 'Esta persona ya tiene un turno a esa hora ese día.' },
    ]);
    expect(await detalles({ userId: 5, date: sumarDias(t.hoy, 3) })).toEqual([
      { field: 'userId', message: 'Esta persona está ausente ese día.' },
    ]);
    expect(await detalles({ userId: 6 })).toEqual([{ field: 'userId', message: 'Elige a un trabajador en activo.' }]);
    expect(await detalles({ date: sumarDias(t.hoy, -1), userId: 1 })).toEqual([
      { field: 'date', message: 'No se pueden asignar turnos de días pasados.' },
    ]);
    expect(await detalles({ shiftTemplateId: 3, date: domingo(), userId: 1 })).toEqual([
      { field: 'date', message: 'Este turno no se hace ese día de la semana.' },
    ]);
    expect(await detalles({ shiftTemplateId: 99, userId: 1 })).toEqual([
      { field: 'shiftTemplateId', message: 'Este turno no existe o está desactivado.' },
    ]);
    expect(await detalles({ userId: 1, zoneIds: [999] })).toEqual([
      { field: 'zoneIds', message: 'Esta zona no existe o está desactivada.' },
    ]);
  });

  it('quita a una persona de un turno que no ha empezado; uno ya fichado no se quita', async () => {
    expect((await nuria.delete(`/api/admin/shift-assignments/${creada.id}`).send({})).status).toBe(403);
    expect((await marta.delete(`/api/admin/shift-assignments/${creada.id}`).send({})).status).toBe(204);
    expect((await marta.delete(`/api/admin/shift-assignments/${creada.id}`).send({})).status).toBe(404);
    const { rows } = await t.pool.query<{ id: number }>(
      'SELECT id FROM shift_assignments WHERE checked_in_at IS NOT NULL LIMIT 1',
    );
    const res = await marta.delete(`/api/admin/shift-assignments/${rows[0]!.id}`).send({});
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SHIFT_ALREADY_STARTED');
  });
});

describe('CU-61 Copiar la semana anterior', () => {
  const lunesSiguiente = () => sumarDias(lunesDe(t.hoy), 7);

  it('la semana empieza en lunes y solo lo hace el administrador', async () => {
    expect(
      (await nuria.post('/api/admin/shift-assignments/copy-week').send({ weekStart: lunesSiguiente() })).status,
    ).toBe(403);
    const res = await marta
      .post('/api/admin/shift-assignments/copy-week')
      .send({ weekStart: sumarDias(lunesSiguiente(), 1) });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field: 'weekStart', message: 'La semana empieza en lunes.' }]);
  });

  it('copia la semana anterior sin duplicar y explica lo que se salta', async () => {
    const lunes = lunesSiguiente();
    // Nuria estará ausente el martes de la semana que viene.
    const ausencia = await marta
      .post('/api/admin/absences')
      .send({ userId: 3, startDate: sumarDias(lunes, 1), endDate: sumarDias(lunes, 1), type: 'personal' });
    expect(ausencia.status).toBe(201);

    const { rows } = await t.pool.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM shift_assignments WHERE shift_date BETWEEN $1 AND $2',
      [lunesDe(t.hoy), sumarDias(lunesDe(t.hoy), 6)],
    );
    const res = await marta.post('/api/admin/shift-assignments/copy-week').send({ weekStart: lunes });
    expect(res.status).toBe(200);
    const resultado: CopyWeekResultDto = res.body;
    expect(resultado.created + resultado.skipped.length).toBe(rows[0]!.n);
    expect(resultado.skipped).toContainEqual({
      date: sumarDias(lunes, 1),
      user: { id: 3, name: 'Nuria Peris Gil' },
      shift: { id: 1, name: 'Mañana', startTime: '07:00', endTime: '15:00' },
      reason: 'ABSENT',
    });
    const nuriaEnLaSemana = await calendario(marta, lunes, sumarDias(lunes, 6));
    expect(nuriaEnLaSemana.assignments.filter((a) => a.user.id === 3).map((a) => a.date)).toEqual(
      [0, 2, 3, 4, 5, 6].map((i) => sumarDias(lunes, i)),
    );

    // Repetirla no crea nada.
    const otraVez: CopyWeekResultDto = (
      await marta.post('/api/admin/shift-assignments/copy-week').send({ weekStart: lunes })
    ).body;
    expect(otraVez.created).toBe(0);
  });
});

describe('CU-35 Desactivar a un trabajador quita sus turnos futuros', () => {
  it('se quitan los de hoy en adelante sin fichar; los pasados se conservan', async () => {
    const turnos = async (cond: string) =>
      (
        await t.pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM shift_assignments WHERE user_id = 5 AND ${cond}`,
          [t.hoy],
        )
      ).rows[0]!.n;
    const pasados = await turnos('shift_date < $1');
    expect(await turnos('shift_date >= $1')).toBeGreaterThan(0);
    expect((await marta.patch('/api/admin/users/5').send({ isActive: false })).status).toBe(200);
    expect(await turnos('shift_date >= $1')).toBe(0);
    expect(await turnos('shift_date < $1')).toBe(pasados);
  });
});
