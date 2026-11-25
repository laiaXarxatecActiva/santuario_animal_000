import type { MemorialAnimalDto } from '@sanctuary/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { entrarComo, type Agente } from './helpers/sesion.js';
import { prepararApp, type TestApp } from './helpers/test-app.js';

let t: TestApp;
let nuria: Agente;
beforeAll(async () => {
  t = await prepararApp();
  nuria = await entrarComo(t.app, 'nuria');
});
afterAll(() => t.pool.end());

const memorial = async (): Promise<MemorialAnimalDto[]> => {
  const res = await request(t.app).get('/api/animals/memorial');
  expect(res.status).toBe(200);
  return res.body.data;
};

describe('CU-12 Consultar la sección «En memoria»', () => {
  it('2: es pública y muestra los fallecidos marcados con foto, especie, llegada, fallecimiento e historia', async () => {
    const lista = await memorial();
    expect(lista.map((a) => a.name)).toEqual(['Faro']);
    const faro = lista[0]!;
    expect(faro).toMatchObject({
      id: 12,
      species: { id: 3, name: 'Alimoche común' },
      arrivalDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      deathDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    expect(faro.rescueStory).toBeTruthy();
    // Sin datos de adopción (es un homenaje, no una ficha para adoptar).
    expect(faro).not.toHaveProperty('adopterCount');
    expect(faro).not.toHaveProperty('isAdoptable');
  });

  it('3: incluye la ficha de solo lectura con sus fotos y actualizaciones públicas, nunca las de adoptantes', async () => {
    const [faro] = await memorial();
    expect(faro!.photos.every((f) => f.visibility === 'public')).toBe(true);
    expect(faro!.updates.every((u) => u.visibility === 'public')).toBe(true);
    const { rows } = await t.pool.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM animal_updates WHERE animal_id = 12 AND visibility = 'public'",
    );
    expect(faro!.updates).toHaveLength(rows[0]!.n);
  });

  it('RN-22: los fallecidos siguen fuera del catálogo y de su ficha pública', async () => {
    expect((await request(t.app).get('/api/animals/12')).status).toBe(404);
  });

  it('panel: al registrar un fallecimiento se puede marcar «Mostrar en En memoria»', async () => {
    const res = await nuria.patch('/api/admin/animals/15/status').send({ status: 'deceased', showInMemorial: true });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'deceased', showInMemorial: true });
    expect((await memorial()).map((a) => a.name)).toContain('Roca');
  });

  it('panel: un fallecido se puede quitar y volver a poner con su interruptor', async () => {
    const quitar = await nuria.patch('/api/admin/animals/15/memorial').send({ showInMemorial: false });
    expect(quitar.status).toBe(200);
    expect(quitar.body.showInMemorial).toBe(false);
    expect((await memorial()).map((a) => a.name)).not.toContain('Roca');

    const poner = await nuria.patch('/api/admin/animals/15/memorial').send({ showInMemorial: true });
    expect(poner.body.showInMemorial).toBe(true);
    expect((await nuria.patch('/api/admin/animals/15/memorial').send({})).status).toBe(400);
  });

  it('RN-22: solo un fallecido puede estar en «En memoria»', async () => {
    const vivo = await nuria.patch('/api/admin/animals/1/memorial').send({ showInMemorial: true });
    expect(vivo.status).toBe(422);
    expect(vivo.body.error.code).toBe('MEMORIAL_ONLY_DECEASED');

    const traslado = await nuria
      .patch('/api/admin/animals/3/status')
      .send({ status: 'transferred', showInMemorial: true });
    expect(traslado.status).toBe(422);
    expect(traslado.body.error.code).toBe('MEMORIAL_ONLY_DECEASED');
  });
});

describe('CU-12 2a: sin animales marcados', () => {
  it('la lista está vacía', async () => {
    await t.pool.query('UPDATE animals SET show_in_memorial = FALSE');
    expect(await memorial()).toEqual([]);
  });
});
