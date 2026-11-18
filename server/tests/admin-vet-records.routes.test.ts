import type { VetRecordDto } from '@sanctuary/shared';
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

const historial = async (animalId: number): Promise<VetRecordDto[]> => {
  const res = await nuria.get(`/api/admin/animals/${animalId}/vet-records`);
  expect(res.status).toBe(200);
  return res.body.data;
};

const nuevo = { recordDate: '', type: 'vaccine', description: 'Vacunación anual.', weightKg: '8,55' };

describe('CU-34 Gestionar el historial veterinario', () => {
  it('es interno: sin sesión 401 y un adoptante 403', async () => {
    expect((await request(t.app).get('/api/admin/animals/1/vet-records')).status).toBe(401);
    expect((await lucia.get('/api/admin/animals/1/vet-records')).status).toBe(403);
    expect((await lucia.post('/api/admin/animals/1/vet-records').send({ ...nuevo, recordDate: t.hoy })).status).toBe(
      403,
    );
  });

  it('2: muestra los registros del animal del más reciente al más antiguo, con el peso y su autor', async () => {
    const lista = await historial(1);
    expect(lista).toHaveLength(2);
    expect(lista[0]).toMatchObject({
      animalId: 1,
      type: 'checkup',
      weightKg: '8.40',
      veterinarian: 'Dra. Paula Sendra',
      createdBy: { id: 3, name: 'Nuria Peris Gil' },
    });
    expect(lista[0]!.recordDate > lista[1]!.recordDate).toBe(true);
  });

  it('2: un animal sin registros devuelve una lista vacía; uno que no existe, 404', async () => {
    expect(await historial(15)).toEqual([]);
    expect((await nuria.get('/api/admin/animals/999/vet-records')).status).toBe(404);
  });

  it('3-4: la cuidadora añade un registro y queda anotado en la actividad', async () => {
    const res = await nuria.post('/api/admin/animals/1/vet-records').send({ ...nuevo, recordDate: t.hoy });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      animalId: 1,
      recordDate: t.hoy,
      type: 'vaccine',
      weightKg: '8.55',
      veterinarian: null,
      createdBy: { id: 3 },
    });
    expect((await historial(1))[0]?.id).toBe(res.body.id);
    const { rows } = await t.pool.query(
      "SELECT user_id, action FROM activity_logs WHERE table_name = 'vet_records' AND record_id = $1",
      [res.body.id],
    );
    expect(rows).toEqual([{ user_id: 3, action: 'create' }]);
  });

  it('4a: una fecha futura o un peso no válido son errores en el campo', async () => {
    const futura = await nuria.post('/api/admin/animals/1/vet-records').send({ ...nuevo, recordDate: '2999-01-01' });
    expect(futura.status).toBe(400);
    expect(futura.body.error.details).toEqual([{ field: 'recordDate', message: 'La fecha no puede ser futura.' }]);

    const peso = await nuria
      .post('/api/admin/animals/1/vet-records')
      .send({ ...nuevo, recordDate: t.hoy, weightKg: '0' });
    expect(peso.status).toBe(400);
    expect(peso.body.error.details[0].field).toBe('weightKg');
  });

  it('A1: la cuidadora edita un registro; uno que no existe da 404', async () => {
    const [registro] = await historial(4);
    const res = await nuria.put(`/api/admin/vet-records/${registro!.id}`).send({
      recordDate: registro!.recordDate,
      type: 'treatment',
      description: 'Fisioterapia: extensión completa del ala.',
      weightKg: '9.70',
      veterinarian: 'Dr. Víctor Albiol',
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: registro!.id,
      weightKg: '9.70',
      description: 'Fisioterapia: extensión completa del ala.',
    });
    expect(
      (await nuria.put('/api/admin/vet-records/9999').send({ recordDate: t.hoy, type: 'checkup', description: 'X' }))
        .status,
    ).toBe(404);
  });

  it('A2: solo el administrador borra (la cuidadora recibe 403)', async () => {
    const [registro] = await historial(2);
    expect((await nuria.delete(`/api/admin/vet-records/${registro!.id}`).send({})).status).toBe(403);
    expect((await marta.delete(`/api/admin/vet-records/${registro!.id}`).send({})).status).toBe(204);
    expect(await historial(2)).toEqual([]);
    expect((await marta.delete(`/api/admin/vet-records/${registro!.id}`).send({})).status).toBe(404);
  });

  it('Postcondición: los adoptantes nunca lo ven (la ficha pública no lo incluye)', async () => {
    const ficha = await lucia.get('/api/animals/1');
    expect(ficha.status).toBe(200);
    expect(JSON.stringify(ficha.body)).not.toMatch(/Dra\. Paula Sendra|vetRecords|weightKg/);
  });
});
