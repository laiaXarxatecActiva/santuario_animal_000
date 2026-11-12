import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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

describe('CU-30 Gestionar especies', () => {
  it('2: lista las especies con su nombre científico y el número de animales', async () => {
    const res = await nuria.get('/api/admin/species');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      expect.objectContaining({
        id: 3,
        name: 'Alimoche común',
        scientificName: 'Neophron percnopterus',
        animalCount: 2,
      }),
      expect.objectContaining({ id: 1, name: 'Buitre leonado', animalCount: 9 }),
      expect.objectContaining({ id: 2, name: 'Buitre negro', animalCount: 3 }),
      expect.objectContaining({ id: 4, name: 'Quebrantahuesos', animalCount: 1 }),
    ]);
    expect(res.body.data[0].description).toMatch(/^El buitre más pequeño/);
  });

  it('3-4: crea una especie y aparece en los filtros del catálogo', async () => {
    const res = await nuria
      .post('/api/admin/species')
      .send({ name: '  Lince ibérico ', scientificName: 'Lynx pardinus', description: '' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: 'Lince ibérico',
      scientificName: 'Lynx pardinus',
      description: null,
      animalCount: 0,
    });
    const publicas = await request(t.app).get('/api/species');
    expect(publicas.body.data.map((s: { name: string }) => s.name)).toContain('Lince ibérico');
  });

  it('3: edita una especie', async () => {
    const res = await nuria
      .put('/api/admin/species/4')
      .send({ name: 'Quebrantahuesos', scientificName: 'Gypaetus barbatus', description: 'Come huesos.' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 4, description: 'Come huesos.', animalCount: 1 });
  });

  it('4a: nombre repetido sin distinguir mayúsculas', async () => {
    const alta = await nuria.post('/api/admin/species').send({ name: 'BUITRE NEGRO' });
    expect(alta.status).toBe(409);
    expect(alta.body.error).toMatchObject({
      code: 'SPECIES_ALREADY_EXISTS',
      message: 'Esta especie ya existe.',
      details: [{ field: 'name', message: 'Esta especie ya existe.' }],
    });
    const edicion = await nuria.put('/api/admin/species/4').send({ name: 'buitre leonado' });
    expect(edicion.status).toBe(409);
  });

  it('4: el nombre es obligatorio', async () => {
    const res = await nuria.post('/api/admin/species').send({ name: '  ' });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field: 'name', message: 'Escribe el nombre de la especie.' }]);
  });

  it('una especie inexistente da 404', async () => {
    expect((await nuria.put('/api/admin/species/999').send({ name: 'Nada' })).status).toBe(404);
  });

  it('A1: solo el administrador borra, y solo si ningún animal la usa', async () => {
    const lince = (await nuria.get('/api/admin/species')).body.data.find(
      (s: { name: string }) => s.name === 'Lince ibérico',
    );
    expect((await nuria.delete(`/api/admin/species/${lince.id}`).send({})).status).toBe(403);

    const enUso = await marta.delete('/api/admin/species/3').send({});
    expect(enUso.status).toBe(409);
    expect(enUso.body.error).toMatchObject({ code: 'SPECIES_IN_USE', message: 'Hay 2 animales de esta especie.' });
    const uno = await marta.delete('/api/admin/species/4').send({});
    expect(uno.body.error.message).toBe('Hay 1 animal de esta especie.');

    expect((await marta.delete(`/api/admin/species/${lince.id}`).send({})).status).toBe(204);
    expect((await marta.delete(`/api/admin/species/${lince.id}`).send({})).status).toBe(404);
  });

  it('RN-18: un adoptante no puede gestionar especies', async () => {
    const lucia = await entrarComo(t.app, 'lucia');
    expect((await lucia.get('/api/admin/species')).status).toBe(403);
    expect((await lucia.post('/api/admin/species').send({ name: 'Otra' })).status).toBe(403);
  });
});
