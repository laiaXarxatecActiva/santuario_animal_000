import type { MyDayDto, MyDayTaskDto } from '@sanctuary/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sumarDias } from '../src/dominio/tareas.js';
import { entrarComo, type Agente } from './helpers/sesion.js';
import { jpeg, prepararAppConSubidas, type TestAppConSubidas } from './helpers/test-uploads.js';

let t: TestAppConSubidas;
let marta: Agente;
let nuria: Agente;
let andres: Agente;
let lucia: Agente;
beforeAll(async () => {
  t = await prepararAppConSubidas();
  marta = await entrarComo(t.app, 'marta');
  nuria = await entrarComo(t.app, 'nuria');
  andres = await entrarComo(t.app, 'andres');
  lucia = await entrarComo(t.app, 'lucia');
});
afterAll(() => t.cerrar());

/** Id de la tarea de una plantilla en un día y una hora. */
const tareaDe = async (plantillaId: number, dia: string, hora: string): Promise<number> => {
  const { rows } = await t.pool.query<{ id: number }>(
    "SELECT id FROM task_instances WHERE template_id = $1 AND due_date = $2 AND to_char(due_time, 'HH24:MI') = $3",
    [plantillaId, dia, hora],
  );
  if (!rows[0]) throw new Error(`No hay tarea de la plantilla ${plantillaId} el ${dia} a las ${hora}`);
  return rows[0].id;
};

const miDia = async (agente: Agente, fecha?: string): Promise<MyDayDto> => {
  const res = await agente.get('/api/admin/my-day').query(fecha ? { date: fecha } : {});
  expect(res.status).toBe(200);
  return res.body;
};

const buscar = (dia: MyDayDto, titulo: string): MyDayTaskDto => {
  const tarea = dia.tasks.find((x) => x.title === titulo);
  if (!tarea) throw new Error(`No está «${titulo}»`);
  return tarea;
};

describe('CU-56 Consultar «Mi día»', () => {
  it('es de los trabajadores: sin sesión 401 y un adoptante 403', async () => {
    expect((await request(t.app).get('/api/admin/my-day')).status).toBe(401);
    expect((await lucia.get('/api/admin/my-day')).status).toBe(403);
  });

  it('1-2: las tareas de hoy, ordenadas por hora, con las atrasadas marcadas', async () => {
    const dia = await miDia(nuria);
    expect(dia.date).toBe(t.hoy);
    const horas = dia.tasks.map((x) => x.dueTime);
    expect(horas).toEqual([...horas].sort());
    expect(buscar(dia, 'Revisión de los animales en tratamiento')).toMatchObject({
      dueTime: '08:30',
      status: 'pending',
      late: true,
      zone: { id: 4, name: 'Clínica y recuperación' },
    });
    expect(buscar(dia, 'Antiinflamatorio de Olmo')).toMatchObject({
      late: true,
      animals: [{ id: 4, name: 'Olmo' }],
      qualification: { id: 1, name: 'Administrar medicación' },
    });
    expect(buscar(dia, 'Limpieza de la cocina')).toMatchObject({ dueTime: '16:00', late: false });
    expect(buscar(dia, 'Comida de los alimoches')).toMatchObject({
      status: 'completed',
      late: false,
      resolvedBy: { id: expect.any(Number) },
    });
  });

  it('2: lo que exige una cualificación que no se tiene aparece bloqueado', async () => {
    expect(buscar(await miDia(nuria), 'Antiinflamatorio de Olmo').blockedReason).toBeNull();
    expect(buscar(await miDia(andres), 'Antiinflamatorio de Olmo').blockedReason).toBe('MISSING_QUALIFICATION');
  });

  it('2: una tarea reasignada a alguien es suya y de nadie más', async () => {
    const puerta = (agente: Agente) => miDia(agente).then((d) => buscar(d, 'Reparar la puerta del almacén'));
    expect(await puerta(andres)).toMatchObject({ mine: true, isOneOff: true, assignedTo: { id: 4 } });
    expect((await puerta(nuria)).mine).toBe(false);
  });

  it('3: se puede consultar otro día; las tareas de mañana no se pueden hacer todavía', async () => {
    const manana = await miDia(nuria, sumarDias(t.hoy, 1));
    expect(manana.date).toBe(sumarDias(t.hoy, 1));
    expect(manana.tasks.length).toBeGreaterThan(0);
    expect(manana.tasks.every((x) => x.blockedReason === 'FUTURE_DAY')).toBe(true);
  });
});

describe('CU-57 Completar una tarea', () => {
  it('1-2: la cuidadora la marca como hecha con un toque; queda quién y cuándo', async () => {
    const id = await tareaDe(8, t.hoy, '08:30');
    const res = await nuria.post(`/api/admin/tasks/${id}/complete`).send({});
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id,
      status: 'completed',
      late: false,
      resolvedBy: { id: 3, name: 'Nuria Peris Gil' },
      resolvedAt: t.reloj.ahora().toISOString(),
      observations: null,
      photoUrl: null,
    });
  });

  it('2a: sin la cualificación que exige, 403 (y así queda en la base de datos)', async () => {
    const id = await tareaDe(11, t.hoy, '09:00');
    const res = await andres.post(`/api/admin/tasks/${id}/complete`).send({});
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('MISSING_QUALIFICATION');
    await expect(
      t.pool.query(
        "UPDATE task_instances SET status = 'completed', resolved_by = 4, resolved_at = NOW() WHERE id = $1",
        [id],
      ),
    ).rejects.toThrow(/exige la cualificación/);
  });

  it('3: con observaciones y una foto (opcionales)', async () => {
    const id = await tareaDe(11, t.hoy, '09:00');
    const res = await nuria
      .post(`/api/admin/tasks/${id}/complete`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .field('observations', 'Se lo ha comido todo con la carne.')
      .attach('files', await jpeg(800, 600), { filename: 'olmo.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(200);
    expect(res.body.observations).toBe('Se lo ha comido todo con la carne.');
    expect(res.body.photoUrl).toMatch(/^\/uploads\/tasks\/\d+\/[0-9a-f-]{36}\.webp$/);
  });

  it('2b: una tarea ya resuelta da 409; una de mañana, 422; una que no existe, 404', async () => {
    const hecha = await tareaDe(3, t.hoy, '10:00');
    const otraVez = await nuria.post(`/api/admin/tasks/${hecha}/complete`).send({});
    expect(otraVez.status).toBe(409);
    expect(otraVez.body.error.code).toBe('TASK_NOT_PENDING');
    const manana = await tareaDe(6, sumarDias(t.hoy, 1), '12:00');
    const adelantada = await nuria.post(`/api/admin/tasks/${manana}/complete`).send({});
    expect(adelantada.status).toBe(422);
    expect(adelantada.body.error.code).toBe('TASK_FUTURE_DAY');
    expect((await nuria.post('/api/admin/tasks/999999/complete').send({})).status).toBe(404);
  });

  it('A1: marcarla como no realizada exige el motivo', async () => {
    const id = await tareaDe(6, t.hoy, '12:00');
    const sinMotivo = await andres.post(`/api/admin/tasks/${id}/not-done`).send({ reason: ' ' });
    expect(sinMotivo.status).toBe(400);
    const res = await andres.post(`/api/admin/tasks/${id}/not-done`).send({ reason: 'Falta sustrato en el almacén.' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'not_done',
      observations: 'Falta sustrato en el almacén.',
      resolvedBy: { id: 4 },
    });
  });

  it('A2: quien la resolvió (o un administrador) puede deshacerlo; los demás, no', async () => {
    const id = await tareaDe(6, t.hoy, '12:00');
    expect((await nuria.post(`/api/admin/tasks/${id}/reopen`).send({})).status).toBe(403);
    const res = await andres.post(`/api/admin/tasks/${id}/reopen`).send({});
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'pending', resolvedBy: null, resolvedAt: null, observations: null });
    await nuria.post(`/api/admin/tasks/${id}/complete`).send({});
    expect((await marta.post(`/api/admin/tasks/${id}/reopen`).send({})).status).toBe(200);
    // Una pendiente no se «deshace».
    expect((await marta.post(`/api/admin/tasks/${id}/reopen`).send({})).status).toBe(409);
  });
});

describe('CU-55 Tareas puntuales y reasignación (administrador)', () => {
  it('el listado del día y las acciones son solo del administrador', async () => {
    expect((await nuria.get('/api/admin/tasks')).status).toBe(403);
    const res = await marta.get('/api/admin/tasks').query({ date: t.hoy, zoneId: 4 });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((x: MyDayTaskDto) => x.zone?.id === 4 && x.dueDate === t.hoy)).toBe(true);
  });

  it('1-2: crea una tarea puntual de una zona y la ve todo el personal', async () => {
    const res = await marta.post('/api/admin/tasks').send({
      type: 'maintenance',
      title: 'Cambiar la bombilla de la cámara',
      zoneId: 5,
      dueDate: t.hoy,
      dueTime: '18:00',
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ isOneOff: true, templateId: null, status: 'pending', assignedTo: null });
    expect(buscar(await miDia(nuria), 'Cambiar la bombilla de la cámara').blockedReason).toBeNull();
  });

  it('3: reasigna una tarea a una persona con la cualificación necesaria', async () => {
    const id = await tareaDe(11, sumarDias(t.hoy, 1), '09:00');
    expect((await nuria.patch(`/api/admin/tasks/${id}/assignee`).send({ userId: 3 })).status).toBe(403);
    const sinCualificacion = await marta.patch(`/api/admin/tasks/${id}/assignee`).send({ userId: 4 });
    expect(sinCualificacion.status).toBe(400);
    expect(sinCualificacion.body.error.details[0]).toEqual({
      field: 'userId',
      message: 'Esta persona no tiene la cualificación que exige la tarea.',
    });
    const adoptante = await marta.patch(`/api/admin/tasks/${id}/assignee`).send({ userId: 6 });
    expect(adoptante.status).toBe(400);
    const res = await marta.patch(`/api/admin/tasks/${id}/assignee`).send({ userId: 3 });
    expect(res.status).toBe(200);
    expect(res.body.assignedTo).toEqual({ id: 3, name: 'Nuria Peris Gil' });
    expect((await marta.patch(`/api/admin/tasks/${id}/assignee`).send({ userId: null })).body.assignedTo).toBeNull();
  });

  it('4: borra una tarea pendiente; una resuelta no se borra', async () => {
    const hecha = await tareaDe(3, t.hoy, '10:00');
    expect((await marta.delete(`/api/admin/tasks/${hecha}`).send({})).status).toBe(409);
    const pendiente = await tareaDe(7, t.hoy, '16:00');
    expect((await marta.delete(`/api/admin/tasks/${pendiente}`).send({})).status).toBe(204);
  });
});
