import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sumarDias } from '../src/dominio/adopcion.js';
import { entrarComo, type Agente } from './helpers/sesion.js';
import { prepararApp, type TestApp } from './helpers/test-app.js';

let t: TestApp;
let nuria: Agente;
let marta: Agente;
beforeAll(async () => {
  t = await prepararApp();
  nuria = await entrarComo(t.app, 'nuria');
  marta = await entrarComo(t.app, 'marta');
});
afterAll(() => t.pool.end());

const nombres = (body: { data: { name: string }[] }) => body.data.map((a) => a.name);

const nuevo = (extra: Record<string, unknown> = {}) => ({
  name: 'Lucero',
  speciesId: 2,
  breed: '',
  sex: 'female',
  approxBirthDate: '2020-05-01',
  arrivalDate: '2026-11-01',
  rescueStory: 'Apareció agotada en un campo de cultivo.',
  temperament: '',
  specialNeeds: '',
  healthSummary: 'Recuperándose.',
  isAdoptable: false,
  isPublished: false,
  ...extra,
});

describe('CU-28 Gestionar animales: listado', () => {
  it('1: lista todos, también los ocultos y archivados, ordenados por nombre', async () => {
    const res = await nuria.get('/api/admin/animals');
    expect(res.status).toBe(200);
    expect(res.body.meta).toMatchObject({ page: 1, total: 15 });
    expect(nombres(res.body)).toContain('Pipa'); // oculta
    expect(nombres(res.body)).toContain('Faro'); // fallecido
    expect(nombres(res.body).slice(0, 3)).toEqual(['Barbas', 'Brisa', 'Canelo']);
    const rufo = res.body.data.find((a: { id: number }) => a.id === 1);
    expect(rufo).toMatchObject({
      name: 'Rufo',
      species: { id: 1, name: 'Buitre leonado' },
      status: 'in_sanctuary',
      isPublished: true,
      isAdoptable: true,
      activeAdopters: 2,
    });
  });

  it('1: busca por nombre y filtra por especie, estado, publicado y adoptable', async () => {
    expect(nombres((await nuria.get('/api/admin/animals?q=ebano')).body)).toEqual(['Ébano']);
    expect(nombres((await nuria.get('/api/admin/animals?speciesId=2')).body)).toEqual(['Carbón', 'Ébano', 'Sombra']);
    expect(nombres((await nuria.get('/api/admin/animals?status=in_treatment')).body)).toEqual([
      'Carbón',
      'Olmo',
      'Pipa',
    ]);
    expect(nombres((await nuria.get('/api/admin/animals?published=false')).body)).toEqual(['Pipa']);
    expect(nombres((await nuria.get('/api/admin/animals?adoptable=false&status=in_sanctuary')).body)).toEqual(['Roca']);
    expect(nombres((await nuria.get('/api/admin/animals?sort=-arrivalDate&pageSize=2')).body)).toEqual([
      'Pipa',
      'Carbón',
    ]);
  });

  it('un filtro u orden no permitido da 400', async () => {
    expect((await nuria.get('/api/admin/animals?sort=health_summary')).status).toBe(400);
    expect((await nuria.get('/api/admin/animals?status=lost')).status).toBe(400);
  });

  it('RN-18: sin sesión 401 y un adoptante 403', async () => {
    expect((await request(t.app).get('/api/admin/animals')).status).toBe(401);
    const lucia = await entrarComo(t.app, 'lucia');
    expect((await lucia.get('/api/admin/animals/1')).status).toBe(403);
  });
});

describe('CU-28 Gestionar animales: ficha, alta y edición', () => {
  it('2: la ficha incluye todos los datos, los ocultos también', async () => {
    const res = await nuria.get('/api/admin/animals/14');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 14,
      name: 'Pipa',
      species: { id: 1, name: 'Buitre leonado' },
      sex: 'unknown',
      status: 'in_treatment',
      isPublished: false,
      isAdoptable: false,
      activeAdopters: 0,
      openAdoptions: 0,
      hasAdoptionHistory: false,
    });
    expect(res.body.arrivalDate).toBe(sumarDias(t.hoy, -10));
    expect((await nuria.get('/api/admin/animals/1')).body).toMatchObject({
      openAdoptions: 2,
      hasAdoptionHistory: true,
    });
    expect((await nuria.get('/api/admin/animals/999')).status).toBe(404);
  });

  it('alta 1-3: crea el animal en el santuario, con los textos vacíos como null', async () => {
    const res = await nuria.post('/api/admin/animals').send(nuevo());
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: 'Lucero',
      species: { id: 2, name: 'Buitre negro' },
      status: 'in_sanctuary',
      breed: null,
      temperament: null,
      healthSummary: 'Recuperándose.',
      isPublished: false,
      coverPhoto: null,
    });
    expect((await nuria.get(`/api/admin/animals/${res.body.id}`)).status).toBe(200);
  });

  it('2a: nacimiento posterior a la llegada da error en el campo', async () => {
    const res = await nuria.post('/api/admin/animals').send(nuevo({ approxBirthDate: '2026-11-02' }));
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      { field: 'approxBirthDate', message: 'La fecha de nacimiento no puede ser posterior a la de llegada.' },
    ]);
  });

  it('la llegada no puede ser futura y la especie debe existir', async () => {
    const futura = await nuria.post('/api/admin/animals').send(nuevo({ arrivalDate: sumarDias(t.hoy, 1) }));
    expect(futura.status).toBe(422);
    expect(futura.body.error.details).toEqual([
      { field: 'arrivalDate', message: 'La fecha de llegada no puede ser futura.' },
    ]);
    const especie = await nuria.post('/api/admin/animals').send(nuevo({ speciesId: 99 }));
    expect(especie.status).toBe(422);
    expect(especie.body.error.details).toEqual([{ field: 'speciesId', message: 'Esta especie no existe.' }]);
  });

  it('2 y A1: edita los datos y oculta un animal sin tocar sus adopciones', async () => {
    const actual = (await nuria.get('/api/admin/animals/1')).body;
    const res = await nuria.put('/api/admin/animals/1').send({
      ...nuevo(),
      name: 'Rufo',
      speciesId: 1,
      approxBirthDate: actual.approxBirthDate,
      arrivalDate: actual.arrivalDate,
      temperament: 'Muy tranquilo.',
      isAdoptable: true,
      isPublished: false,
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ temperament: 'Muy tranquilo.', isPublished: false, activeAdopters: 2 });
    expect((await request(t.app).get('/api/animals/1')).status).toBe(404);
    await nuria.put('/api/admin/animals/1').send({ ...res.body, speciesId: 1, isPublished: true });
    expect((await request(t.app).get('/api/animals/1')).status).toBe(200);
  });

  it('2b: un animal fallecido o trasladado no puede ser adoptable', async () => {
    const faro = (await nuria.get('/api/admin/animals/12')).body;
    const res = await nuria.put('/api/admin/animals/12').send({ ...faro, speciesId: 3, isAdoptable: true });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({
      code: 'ARCHIVED_ANIMAL_NOT_ADOPTABLE',
      details: [{ field: 'isAdoptable', message: 'Un animal fallecido o trasladado no puede admitir adopciones.' }],
    });
  });
});

describe('CU-28 Gestionar animales: cambio de estado', () => {
  it('A2: entre «en el santuario» y «en tratamiento» es directo', async () => {
    const res = await nuria.patch('/api/admin/animals/3/status').send({ status: 'in_treatment' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'in_treatment', statusChangedAt: null, isAdoptable: true });
    const { rows } = await t.pool.query(
      "SELECT count(*)::int AS n FROM adoptions WHERE animal_id = 3 AND status = 'active'",
    );
    expect(rows[0].n).toBe(1);
  });

  it('A3 (CU-33 5.1-5.2): fallecido cierra las adopciones activas, pausadas y pendientes', async () => {
    const fecha = sumarDias(t.hoy, -1);
    // Lupe: adopción pausada de Elena; se le añade una pendiente de Adrián.
    await t.pool.query('INSERT INTO adoptions (user_id, animal_id, plan_id) VALUES (13, 11, 1)');
    const res = await nuria.patch('/api/admin/animals/11/status').send({ status: 'deceased', date: fecha });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'deceased',
      statusChangedAt: fecha,
      isAdoptable: false,
      openAdoptions: 0,
    });
    const { rows } = await t.pool.query(
      'SELECT user_id, status, end_reason, end_date::text FROM adoptions WHERE animal_id = 11 ORDER BY user_id',
    );
    expect(rows).toEqual([
      { user_id: 8, status: 'finished', end_reason: 'animal_deceased', end_date: fecha },
      { user_id: 13, status: 'cancelled', end_reason: 'animal_deceased', end_date: fecha },
    ]);
  });

  it('trasladado sin fecha usa la de hoy; ya no aparece en el catálogo', async () => {
    const res = await nuria.patch('/api/admin/animals/7/status').send({ status: 'transferred' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'transferred', statusChangedAt: t.hoy });
    const { rows } = await t.pool.query(
      'SELECT DISTINCT end_reason FROM adoptions WHERE animal_id = 7 AND end_date = $1',
      [t.hoy],
    );
    expect(rows).toEqual([{ end_reason: 'animal_transferred' }]);
    expect((await request(t.app).get('/api/animals/7')).status).toBe(404);
  });

  it('un animal archivado no cambia de estado y la fecha no puede ser futura', async () => {
    const archivado = await nuria.patch('/api/admin/animals/12/status').send({ status: 'in_sanctuary' });
    expect(archivado.status).toBe(422);
    expect(archivado.body.error.code).toBe('ANIMAL_ARCHIVED');
    const futura = await nuria
      .patch('/api/admin/animals/2/status')
      .send({ status: 'deceased', date: sumarDias(t.hoy, 2) });
    expect(futura.status).toBe(422);
    expect(futura.body.error.details).toEqual([{ field: 'date', message: 'La fecha no puede ser futura.' }]);
  });
});

describe('CU-28 A4 Borrar un animal', () => {
  it('solo el administrador', async () => {
    expect((await nuria.delete('/api/admin/animals/15').send({})).status).toBe(403);
  });

  it('RN-17: no se borra un animal con historial de adopciones', async () => {
    const res = await marta.delete('/api/admin/animals/13').send({});
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: 'ANIMAL_HAS_ADOPTIONS',
      message: 'Este animal tiene historial de adopciones; archívalo cambiando su estado.',
    });
  });

  it('borra un animal sin adopciones con sus fotos y actualizaciones', async () => {
    expect((await marta.delete('/api/admin/animals/15').send({})).status).toBe(204);
    expect((await marta.get('/api/admin/animals/15')).status).toBe(404);
    const { rows } = await t.pool.query(
      `SELECT (SELECT count(*) FROM animal_updates WHERE animal_id = 15)::int AS updates,
              (SELECT count(*) FROM photos WHERE animal_id = 15)::int AS photos`,
    );
    expect(rows[0]).toEqual({ updates: 0, photos: 0 });
    expect((await marta.delete('/api/admin/animals/15').send({})).status).toBe(404);
  });
});
