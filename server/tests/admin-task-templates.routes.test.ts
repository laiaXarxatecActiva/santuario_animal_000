import type { TaskTemplateBody, TaskTemplateDto } from '@sanctuary/shared';
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

/** Tareas generadas de una plantilla: [día, hora, estado], en orden. */
const tareasDe = async (plantillaId: number): Promise<[string, string, string][]> =>
  (
    await t.pool.query<{ d: string; h: string; status: string }>(
      `SELECT due_date::text AS d, to_char(due_time, 'HH24:MI') AS h, status
         FROM task_instances WHERE template_id = $1 ORDER BY due_at`,
      [plantillaId],
    )
  ).rows.map((r) => [r.d, r.h, r.status]);

const base = (): TaskTemplateBody => ({
  type: 'cleaning',
  title: 'Limpiar los bebederos del voladero de alimoches',
  zoneId: 3,
  times: ['18:00', '07:30'],
  recurrence: 'daily',
  startDate: t.hoy,
});

describe('CU-54 Gestionar plantillas de tareas', () => {
  it('solo el administrador: sin sesión 401, adoptante y cuidadora 403', async () => {
    expect((await request(t.app).get('/api/admin/task-templates')).status).toBe(401);
    expect((await lucia.get('/api/admin/task-templates')).status).toBe(403);
    expect((await nuria.get('/api/admin/task-templates')).status).toBe(403);
    expect((await nuria.post('/api/admin/task-templates').send(base())).status).toBe(403);
  });

  it('1: lista las plantillas con su zona, animales, cualificación y si tienen historial', async () => {
    const res = await marta.get('/api/admin/task-templates');
    expect(res.status).toBe(200);
    const lista: TaskTemplateDto[] = res.body.data;
    expect(lista).toHaveLength(11);
    expect(lista.find((p) => p.id === 11)).toMatchObject({
      type: 'medication',
      zone: { id: 4, name: 'Clínica y recuperación' },
      animals: [{ id: 4, name: 'Olmo' }],
      qualification: { id: 1, name: 'Administrar medicación' },
      times: ['09:00'],
      recurrence: 'daily',
      hasHistory: true,
    });
    expect(lista.find((p) => p.id === 1)).toMatchObject({ recurrence: 'weekdays', weekdays: [1, 3, 5] });
  });

  it('2-3: al crearla se generan sus tareas de los próximos 7 días, solo desde ahora', async () => {
    const res = await marta.post('/api/admin/task-templates').send(base());
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ times: ['07:30', '18:00'], isActive: true, hasHistory: false });
    const tareas = await tareasDe(res.body.id);
    // Hoy ya han pasado las 07:30 (el reloj de las pruebas marca las 12:00 UTC).
    expect(tareas[0]).toEqual([t.hoy, '18:00', 'pending']);
    expect(tareas).toHaveLength(13);
    expect(tareas.at(-1)).toEqual([sumarDias(t.hoy, 6), '18:00', 'pending']);
    const { rows } = await t.pool.query(
      "SELECT user_id, action FROM activity_logs WHERE table_name = 'task_templates' AND record_id = $1",
      [res.body.id],
    );
    expect(rows).toEqual([{ user_id: 1, action: 'create' }]);
  });

  it('2: sin zona, la toma de sus animales; si viven en zonas distintas o ya no están, es un error', async () => {
    const res = await marta
      .post('/api/admin/task-templates')
      .send({ ...base(), type: 'health_check', title: 'Pesar a Lupe', zoneId: null, animalIds: [11] });
    expect(res.status).toBe(201);
    expect(res.body.zone).toEqual({ id: 3, name: 'Voladero de alimoches' });

    const mezcla = await marta.post('/api/admin/task-templates').send({ ...base(), zoneId: null, animalIds: [1, 8] });
    expect(mezcla.status).toBe(400);
    expect(mezcla.body.error.details[0].field).toBe('animalIds');

    const fallecido = await marta.post('/api/admin/task-templates').send({ ...base(), animalIds: [12] });
    expect(fallecido.status).toBe(400);
    expect(fallecido.body.error.details[0]).toEqual({
      field: 'animalIds',
      message: 'Faro ya no está en el santuario.',
    });
  });

  it('2a: valida la recurrencia, las horas y las fechas', async () => {
    const sinDias = await marta.post('/api/admin/task-templates').send({ ...base(), recurrence: 'weekdays' });
    expect(sinDias.status).toBe(400);
    expect(sinDias.body.error.details.map((d: { field: string }) => d.field)).toEqual(['weekdays']);
    const sinHoras = await marta.post('/api/admin/task-templates').send({ ...base(), times: [] });
    expect(sinHoras.body.error.details[0].field).toBe('times');
    const alReves = await marta.post('/api/admin/task-templates').send({ ...base(), endDate: sumarDias(t.hoy, -1) });
    expect(alReves.body.error.details[0].field).toBe('endDate');
    const zona = await marta.post('/api/admin/task-templates').send({ ...base(), zoneId: 999 });
    expect(zona.status).toBe(400);
    expect(zona.body.error.details[0].field).toBe('zoneId');
  });

  it('4: editarla solo cambia las tareas futuras sin resolver; las ya hechas se quedan como estaban', async () => {
    // Plantilla 4 (comida de la clínica, 09:00 y 17:00): hoy la de las 09:00 está hecha.
    const antes = await tareasDe(4);
    const hechasAntes = antes.filter(([, , estado]) => estado !== 'pending');
    const res = await marta.put('/api/admin/task-templates/4').send({
      type: 'feeding',
      title: 'Comida de la clínica',
      zoneId: 4,
      times: ['09:00', '18:30'],
      recurrence: 'daily',
      startDate: sumarDias(t.hoy, -365),
    });
    expect(res.status).toBe(200);
    const despues = await tareasDe(4);
    expect(despues.filter(([, , estado]) => estado !== 'pending')).toEqual(hechasAntes);
    const deHoy = despues.filter(([dia]) => dia === t.hoy);
    expect(deHoy).toEqual([
      [t.hoy, '09:00', 'completed'],
      [t.hoy, '18:30', 'pending'],
    ]);
    // Las de las 17:00 que quedaban pendientes ya no existen.
    expect(despues.filter(([, hora, estado]) => hora === '17:00' && estado === 'pending')).toEqual([]);
    expect(despues.filter(([dia]) => dia === sumarDias(t.hoy, 6)).map(([, hora]) => hora)).toEqual(['09:00', '18:30']);
  });

  it('5: al desactivarla desaparecen sus tareas pendientes futuras', async () => {
    const res = await marta.put('/api/admin/task-templates/7').send({
      type: 'cleaning',
      title: 'Limpieza de la cocina',
      zoneId: 5,
      times: ['16:00'],
      recurrence: 'daily',
      startDate: sumarDias(t.hoy, -365),
      isActive: false,
    });
    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
    const tareas = await tareasDe(7);
    expect(tareas.filter(([dia, , estado]) => dia >= t.hoy && estado === 'pending')).toEqual([]);
    expect(tareas.length).toBeGreaterThan(0); // el historial sigue
  });

  it('6: una plantilla con historial no se borra; una sin tareas resueltas, sí (con sus pendientes)', async () => {
    const conHistorial = await marta.delete('/api/admin/task-templates/3').send({});
    expect(conHistorial.status).toBe(409);
    expect(conHistorial.body.error.code).toBe('TEMPLATE_HAS_HISTORY');
    const nueva = await marta.post('/api/admin/task-templates').send({ ...base(), title: 'Para borrar' });
    expect((await marta.delete(`/api/admin/task-templates/${nueva.body.id}`).send({})).status).toBe(204);
    expect(await tareasDe(nueva.body.id)).toEqual([]);
    expect((await marta.get(`/api/admin/task-templates/${nueva.body.id}`)).status).toBe(404);
  });
});
