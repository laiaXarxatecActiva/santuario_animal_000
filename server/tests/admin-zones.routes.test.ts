import type { QualificationDto, ZoneDto } from '@sanctuary/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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

const actividad = async (tabla: string, id: number) =>
  (
    await t.pool.query('SELECT user_id, action FROM activity_logs WHERE table_name = $1 AND record_id = $2', [
      tabla,
      id,
    ])
  ).rows;

describe('CU-52 Gestionar zonas', () => {
  it('es del panel: sin sesión 401 y un adoptante 403', async () => {
    expect((await request(t.app).get('/api/admin/zones')).status).toBe(401);
    expect((await lucia.get('/api/admin/zones')).status).toBe(403);
  });

  it('1: los trabajadores ven las zonas con el número de animales que viven en ellas', async () => {
    const res = await nuria.get('/api/admin/zones');
    expect(res.status).toBe(200);
    const zonas: ZoneDto[] = res.body.data;
    expect(zonas.map((z) => z.name)).toEqual([
      'Clínica y recuperación',
      'Cocina y almacén',
      'Gran voladero',
      'Voladero de alimoches',
      'Voladero de buitres negros',
    ]);
    // Faro (12) falleció: no cuenta en el voladero de alimoches.
    expect(zonas.find((z) => z.id === 3)).toMatchObject({ animalCount: 1, isActive: true });
    expect(zonas.find((z) => z.id === 1)?.animalCount).toBe(7);
  });

  it('2: solo el administrador crea y edita; queda en el registro de actividad', async () => {
    const nueva = { name: 'Voladero de quebrantahuesos', description: 'Con roquedo para romper huesos.' };
    expect((await nuria.post('/api/admin/zones').send(nueva)).status).toBe(403);
    const res = await marta.post('/api/admin/zones').send(nueva);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: nueva.name, isActive: true, animalCount: 0 });
    expect(await actividad('zones', res.body.id)).toEqual([{ user_id: 1, action: 'create' }]);

    const editada = await marta
      .put(`/api/admin/zones/${res.body.id}`)
      .send({ name: 'Voladero de quebrantahuesos', isActive: false });
    expect(editada.status).toBe(200);
    expect(editada.body).toMatchObject({ isActive: false, description: null });
  });

  it('2a: el nombre no se repite (sin distinguir mayúsculas)', async () => {
    const res = await marta.post('/api/admin/zones').send({ name: 'gran VOLADERO' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ZONE_NAME_TAKEN');
  });

  it('A1: una zona con animales o tareas no se borra (se desactiva); una vacía, sí', async () => {
    const enUso = await marta.delete('/api/admin/zones/1').send({});
    expect(enUso.status).toBe(409);
    expect(enUso.body.error.code).toBe('ZONE_IN_USE');
    const vacia = await marta.post('/api/admin/zones').send({ name: 'Zona de pruebas' });
    expect((await nuria.delete(`/api/admin/zones/${vacia.body.id}`).send({})).status).toBe(403);
    expect((await marta.delete(`/api/admin/zones/${vacia.body.id}`).send({})).status).toBe(204);
    expect((await marta.delete(`/api/admin/zones/${vacia.body.id}`).send({})).status).toBe(404);
  });

  it('CU-28: la ficha del animal muestra su zona y se cambia al editarlo', async () => {
    const ficha = await nuria.get('/api/admin/animals/8');
    expect(ficha.body.zone).toEqual({ id: 2, name: 'Voladero de buitres negros' });
    const { zone: _zona, ...resto } = ficha.body;
    void _zona;
    const datos = {
      name: resto.name,
      speciesId: resto.species.id,
      sex: resto.sex,
      approxBirthDate: resto.approxBirthDate,
      arrivalDate: resto.arrivalDate,
      isAdoptable: resto.isAdoptable,
      isPublished: resto.isPublished,
    };
    const movido = await nuria.put('/api/admin/animals/8').send({ ...datos, zoneId: 1 });
    expect(movido.status).toBe(200);
    expect(movido.body.zone).toEqual({ id: 1, name: 'Gran voladero' });
    // Sin el campo, la zona no cambia.
    expect((await nuria.put('/api/admin/animals/8').send(datos)).body.zone?.id).toBe(1);
    const inexistente = await nuria.put('/api/admin/animals/8').send({ ...datos, zoneId: 999 });
    expect(inexistente.status).toBe(400);
    expect(inexistente.body.error.details[0].field).toBe('zoneId');
  });
});

describe('CU-53 Gestionar cualificaciones', () => {
  it('1: lista las cualificaciones con cuántos trabajadores las tienen', async () => {
    const res = await nuria.get('/api/admin/qualifications');
    expect(res.status).toBe(200);
    const lista: QualificationDto[] = res.body.data;
    expect(lista.map((q) => [q.name, q.workerCount])).toEqual([
      ['Administrar medicación', 2],
      ['Manejo de grandes rapaces', 2],
      ['Mantenimiento de instalaciones', 2],
    ]);
  });

  it('2: solo el administrador crea, edita y borra las que no se usan', async () => {
    expect((await nuria.post('/api/admin/qualifications').send({ name: 'Conducir la furgoneta' })).status).toBe(403);
    const nueva = await marta.post('/api/admin/qualifications').send({ name: 'Conducir la furgoneta' });
    expect(nueva.status).toBe(201);
    expect(nueva.body).toMatchObject({ name: 'Conducir la furgoneta', workerCount: 0 });
    const editada = await marta
      .put(`/api/admin/qualifications/${nueva.body.id}`)
      .send({ name: 'Conducir la furgoneta', description: 'Carné B.' });
    expect(editada.body.description).toBe('Carné B.');
    const repetida = await marta.post('/api/admin/qualifications').send({ name: 'conducir la furgoneta' });
    expect(repetida.status).toBe(409);
    expect((await marta.delete(`/api/admin/qualifications/${nueva.body.id}`).send({})).status).toBe(204);
    const enUso = await marta.delete('/api/admin/qualifications/1').send({});
    expect(enUso.status).toBe(409);
    expect(enUso.body.error.code).toBe('QUALIFICATION_IN_USE');
  });

  it('3: el administrador asigna las cualificaciones de un trabajador', async () => {
    const antes = await marta.get('/api/admin/users/5/qualifications');
    expect(antes.status).toBe(200);
    expect(antes.body).toEqual({ userId: 5, qualifications: [] });
    expect((await nuria.put('/api/admin/users/5/qualifications').send({ qualificationIds: [1] })).status).toBe(403);
    const res = await marta.put('/api/admin/users/5/qualifications').send({ qualificationIds: [2, 1, 2] });
    expect(res.status).toBe(200);
    expect(res.body.qualifications.map((q: { id: number }) => q.id)).toEqual([1, 2]);
    expect(await actividad('users', 5)).toContainEqual({ user_id: 1, action: 'update' });
  });

  it('3a: un adoptante no tiene cualificaciones (404) y una cualificación inexistente es un error', async () => {
    expect((await marta.put('/api/admin/users/6/qualifications').send({ qualificationIds: [1] })).status).toBe(404);
    const res = await marta.put('/api/admin/users/5/qualifications').send({ qualificationIds: [999] });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('qualificationIds');
  });
});
