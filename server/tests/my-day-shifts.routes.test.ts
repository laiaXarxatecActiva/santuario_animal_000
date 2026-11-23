import type { MyDayDto } from '@sanctuary/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sumarDias } from '../src/dominio/tareas.js';
import { entrarComo, type Agente } from './helpers/sesion.js';
import { prepararApp, type TestApp } from './helpers/test-app.js';

let t: TestApp;
let marta: Agente;
let nuria: Agente;
let andres: Agente;
beforeAll(async () => {
  t = await prepararApp();
  marta = await entrarComo(t.app, 'marta');
  nuria = await entrarComo(t.app, 'nuria');
  andres = await entrarComo(t.app, 'andres');
});
afterAll(() => t.pool.end());

const miDia = async (agente: Agente, fecha?: string): Promise<MyDayDto> =>
  (await agente.get('/api/admin/my-day').query(fecha ? { date: fecha } : {})).body;

const esMia = (dia: MyDayDto, titulo: string, hora: string) =>
  dia.tasks.find((x) => x.title === titulo && x.dueTime === hora)?.mine;

describe('CU-56 «Mi día» según el turno', () => {
  it('1: muestra los turnos de la persona ese día', async () => {
    const dia = await miDia(nuria);
    expect(dia.shifts).toEqual([
      expect.objectContaining({
        shift: { id: 1, name: 'Mañana', startTime: '07:00', endTime: '15:00' },
        date: t.hoy,
        zones: [
          { id: 4, name: 'Clínica y recuperación' },
          { id: 3, name: 'Voladero de alimoches' },
        ],
        checkedInAt: null,
        checkedOutAt: null,
      }),
    ]);
    expect((await miDia(marta)).shifts).toEqual([]);
  });

  it('2: sin asignar a nadie, una tarea es de quien tiene turno en su zona a esa hora', async () => {
    const nuriaHoy = await miDia(nuria);
    const andresHoy = await miDia(andres);
    // Clínica (Nuria por la mañana; por la tarde, Carmen).
    expect(esMia(nuriaHoy, 'Revisión de los animales en tratamiento', '08:30')).toBe(true);
    expect(esMia(andresHoy, 'Revisión de los animales en tratamiento', '08:30')).toBe(false);
    expect(esMia(nuriaHoy, 'Comida de la clínica', '09:00')).toBe(true);
    expect(esMia(nuriaHoy, 'Comida de la clínica', '17:00')).toBe(false);
    // Alimoches (Nuria por la mañana).
    expect(esMia(nuriaHoy, 'Comida de los alimoches', '10:00')).toBe(true);
    // Cocina a las 16:00: la mañana de Andrés ya ha acabado.
    expect(esMia(andresHoy, 'Limpieza de la cocina', '16:00')).toBe(false);
  });
});

describe('CU-63 Fichar la entrada y la salida', () => {
  const turnoDe = async (userId: number, fecha: string): Promise<number> => {
    const { rows } = await t.pool.query<{ id: number }>(
      'SELECT id FROM shift_assignments WHERE user_id = $1 AND shift_date = $2 ORDER BY id LIMIT 1',
      [userId, fecha],
    );
    return rows[0]!.id;
  };

  it('1-2: la persona ficha la entrada y la salida de su turno de hoy, una vez cada una', async () => {
    const id = await turnoDe(3, t.hoy);
    const entrada = await nuria.post(`/api/admin/shift-assignments/${id}/check-in`).send({});
    expect(entrada.status).toBe(200);
    expect(entrada.body.checkedInAt).toEqual(expect.any(String));
    expect((await miDia(nuria)).shifts[0]!.checkedInAt).toBe(entrada.body.checkedInAt);

    const otra = await nuria.post(`/api/admin/shift-assignments/${id}/check-in`).send({});
    expect(otra.status).toBe(409);
    expect(otra.body.error.code).toBe('ALREADY_CHECKED_IN');

    const salida = await nuria.post(`/api/admin/shift-assignments/${id}/check-out`).send({});
    expect(salida.status).toBe(200);
    expect(salida.body.checkedOutAt).toEqual(expect.any(String));
    const otraSalida = await nuria.post(`/api/admin/shift-assignments/${id}/check-out`).send({});
    expect(otraSalida.status).toBe(409);
    expect(otraSalida.body.error.code).toBe('ALREADY_CHECKED_OUT');
  });

  it('1a: solo se ficha el turno propio y el mismo día; la salida, después de la entrada', async () => {
    expect(
      (await andres.post(`/api/admin/shift-assignments/${await turnoDe(3, t.hoy)}/check-in`).send({})).status,
    ).toBe(404);

    const manana = await nuria
      .post(`/api/admin/shift-assignments/${await turnoDe(3, sumarDias(t.hoy, 1))}/check-in`)
      .send({});
    expect(manana.status).toBe(422);
    expect(manana.body.error.code).toBe('SHIFT_NOT_TODAY');

    const creada = await marta
      .post('/api/admin/shift-assignments')
      .send({ shiftTemplateId: 2, date: t.hoy, userId: 1, zoneIds: [5] });
    expect(creada.status).toBe(201);
    const sinEntrada = await marta.post(`/api/admin/shift-assignments/${creada.body.id}/check-out`).send({});
    expect(sinEntrada.status).toBe(409);
    expect(sinEntrada.body.error.code).toBe('NOT_CHECKED_IN');
  });
});
