import type { HandoverNoteDto } from '@sanctuary/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { entrarComo, type Agente } from './helpers/sesion.js';
import { prepararApp, type TestApp } from './helpers/test-app.js';

// En TEST_DATA.sql, hoy Nuria tiene turno de mañana en la clínica (4) y el
// voladero de alimoches (3); Andrés, en el gran voladero (1), el de buitres
// negros (2) y la cocina (5). Anoche Carmen dejó una nota en la clínica (1) y
// otra en los alimoches (3, ya leída por Nuria); la de Andrés en el gran
// voladero (2) es de hace 2 días. El reloj marca las 13:00 de Madrid.

let t: TestApp;
let marta: Agente;
let nuria: Agente;
let andres: Agente;
let lucia: Agente;
beforeAll(async () => {
  t = await prepararApp();
  marta = await entrarComo(t.app, 'marta');
  nuria = await entrarComo(t.app, 'nuria');
  andres = await entrarComo(t.app, 'andres');
  lucia = await entrarComo(t.app, 'lucia');
});
afterAll(() => t.pool.end());

const notas = async (agente: Agente): Promise<HandoverNoteDto[]> => {
  const res = await agente.get('/api/admin/handover-notes');
  expect(res.status).toBe(200);
  return res.body.data;
};

describe('CU-71 Leer las notas de relevo', () => {
  it('cada persona ve las de las últimas 24 horas de las zonas de su turno de hoy, la más reciente primero', async () => {
    expect(await notas(nuria)).toEqual([
      {
        id: 1,
        zone: { id: 4, name: 'Clínica y recuperación' },
        author: { id: 5, name: 'Carmen Boix Vidal' },
        body: 'Carbón ha estado tranquilo; dejad la luz baja en su jaula.',
        createdAt: expect.any(String),
        isRead: false,
        mine: false,
      },
      expect.objectContaining({ id: 3, zone: { id: 3, name: 'Voladero de alimoches' }, isRead: true }),
    ]);
    // La de su zona es de hace 2 días: ya no sale.
    expect(await notas(andres)).toEqual([]);
  });

  it('el administrador ve las de todas las zonas', async () => {
    expect((await notas(marta)).map((n) => n.id)).toEqual([1, 3]);
  });

  it('se marcan como leídas', async () => {
    const res = await nuria.put('/api/admin/handover-notes/1/read').send({});
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 1, isRead: true });
    expect((await notas(nuria)).find((n) => n.id === 1)?.isRead).toBe(true);
    // Para los demás sigue sin leer.
    expect((await notas(marta)).find((n) => n.id === 1)?.isRead).toBe(false);
    expect((await nuria.put('/api/admin/handover-notes/999/read').send({})).status).toBe(404);
  });

  it('solo el personal', async () => {
    expect((await lucia.get('/api/admin/handover-notes')).status).toBe(403);
  });
});

describe('CU-71 Escribir una nota de relevo', () => {
  it('en una zona de su turno de hoy; la propia sale como leída', async () => {
    const res = await nuria
      .post('/api/admin/handover-notes')
      .send({ zoneId: 4, body: 'Pipa no ha querido la comida de las 09:00.' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      zone: { id: 4, name: 'Clínica y recuperación' },
      author: { id: 3, name: 'Nuria Peris Gil' },
      body: 'Pipa no ha querido la comida de las 09:00.',
      isRead: true,
      mine: true,
    });
    expect((await notas(nuria))[0]?.id).toBe(res.body.id);
  });

  it('no en una zona en la que no tiene turno hoy', async () => {
    const res = await nuria.post('/api/admin/handover-notes').send({ zoneId: 1, body: 'Hola.' });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field: 'zoneId', message: 'No tienes turno hoy en esta zona.' }]);
  });

  it('el administrador, en cualquier zona; la ve quien tiene turno en ella', async () => {
    const res = await marta.post('/api/admin/handover-notes').send({ zoneId: 1, body: 'Mañana viene el herrero.' });
    expect(res.status).toBe(201);
    expect((await notas(andres)).map((n) => n.body)).toEqual(['Mañana viene el herrero.']);
  });

  it('valida la nota', async () => {
    const res = await marta.post('/api/admin/handover-notes').send({ body: '  ' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { field: string }) => d.field).sort()).toEqual(['body', 'zoneId']);
  });
});
