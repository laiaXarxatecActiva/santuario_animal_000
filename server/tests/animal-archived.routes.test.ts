import type { AdminUpdateListItemDto } from '@sanctuary/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { entrarComo, type Agente } from './helpers/sesion.js';
import { prepararApp, type TestApp } from './helpers/test-app.js';

// TEST_DATA: Faro (12) ha fallecido y está en «En memoria»; Barbas (13) fue trasladado.
let t: TestApp;
let nuria: Agente;
let marta: Agente;
beforeAll(async () => {
  t = await prepararApp();
  nuria = await entrarComo(t.app, 'nuria');
  marta = await entrarComo(t.app, 'marta');
});
afterAll(() => t.pool.end());

const SOLO_LECTURA = 'ANIMAL_ARCHIVED_READ_ONLY';

const esSoloLectura = (res: { status: number; body: { error?: { code: string } } }) => {
  expect(res.status).toBe(422);
  expect(res.body.error?.code).toBe(SOLO_LECTURA);
};

const vetDe = async (animalId: number) => {
  const { rows } = await t.pool.query<{ id: number }>('SELECT id FROM vet_records WHERE animal_id = $1 LIMIT 1', [
    animalId,
  ]);
  return rows[0]!.id;
};

describe('RN-22 Un animal fallecido o trasladado solo se consulta', () => {
  it('su ficha, sus fotos, sus actualizaciones y su historial se siguen viendo', async () => {
    expect((await nuria.get('/api/admin/animals/12')).status).toBe(200);
    expect((await nuria.get('/api/admin/animals/12/photos')).body.data.length).toBeGreaterThan(0);
    expect((await nuria.get('/api/admin/animals/12/vet-records')).body.data.length).toBeGreaterThan(0);
    const actualizaciones = await marta.get('/api/admin/updates').query({ animalId: 12 });
    expect(actualizaciones.body.data.length).toBeGreaterThan(0);
    // Nadie puede editarlas, ni siquiera el administrador.
    expect(actualizaciones.body.data.every((u: AdminUpdateListItemDto) => !u.canEdit)).toBe(true);
  });

  it('CU-29: no se suben, editan, ordenan, ponen de portada ni borran fotos', async () => {
    esSoloLectura(
      await nuria
        .post('/api/admin/animals/13/photos')
        .set('X-Requested-With', 'XMLHttpRequest')
        .field('meta', JSON.stringify([{ altText: 'Barbas', visibility: 'public' }]))
        .attach('files', Buffer.from('no importa'), { filename: 'barbas.jpg', contentType: 'image/jpeg' }),
    );
    esSoloLectura(await nuria.patch('/api/admin/photos/13').send({ altText: 'Otro texto', visibility: 'public' }));
    esSoloLectura(await nuria.put('/api/admin/animals/13/photos/order').send({ photoIds: [13] }));
    esSoloLectura(await nuria.put('/api/admin/animals/13/cover').send({ photoId: 13 }));
    esSoloLectura(await marta.delete('/api/admin/photos/13').send({}));
    const { rows } = await t.pool.query('SELECT alt_text FROM photos WHERE id = 13');
    expect(rows).toEqual([{ alt_text: 'Barbas, quebrantahuesos, con las alas abiertas' }]);
  });

  it('CU-32: sus actualizaciones no se editan ni se borran', async () => {
    esSoloLectura(
      await marta
        .put('/api/admin/updates/20')
        .send({ title: 'Otro título', body: 'Otro texto.', visibility: 'public' }),
    );
    esSoloLectura(await marta.delete('/api/admin/updates/20').send({}));
    expect((await marta.get('/api/admin/updates/20')).body.title).toBe('Barbas se traslada');
  });

  it('CU-34: su historial veterinario no admite registros nuevos ni cambios', async () => {
    const registro = { recordDate: t.hoy, type: 'checkup', description: 'Revisión.', weightKg: '' };
    esSoloLectura(await nuria.post('/api/admin/animals/12/vet-records').send(registro));
    const id = await vetDe(12);
    esSoloLectura(await nuria.put(`/api/admin/vet-records/${id}`).send(registro));
    esSoloLectura(await marta.delete(`/api/admin/vet-records/${id}`).send({}));
  });

  it('CU-12: «En memoria» sí se puede cambiar en un fallecido', async () => {
    const res = await nuria.patch('/api/admin/animals/12/memorial').send({ showInMemorial: false });
    expect(res.status).toBe(200);
    expect(res.body.showInMemorial).toBe(false);
    await nuria.patch('/api/admin/animals/12/memorial').send({ showInMemorial: true });
  });
});

describe('CU-33 Corregir el estado de un animal archivado (solo el administrador)', () => {
  it('el administrador devuelve a Faro al santuario: sus adopciones siguen cerradas', async () => {
    const antes = await t.pool.query('SELECT id, status, end_reason FROM adoptions WHERE animal_id = 12 ORDER BY id');
    const res = await marta.patch('/api/admin/animals/12/status').send({ status: 'in_sanctuary' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'in_sanctuary',
      statusChangedAt: null,
      isAdoptable: false,
      showInMemorial: false,
      openAdoptions: 0,
    });
    const despues = await t.pool.query('SELECT id, status, end_reason FROM adoptions WHERE animal_id = 12 ORDER BY id');
    expect(despues.rows).toEqual(antes.rows);
    // De nuevo en el santuario, su información vuelve a poder editarse.
    const ficha = (await nuria.get('/api/admin/animals/12')).body;
    const editar = await nuria.put('/api/admin/animals/12').send({
      ...ficha,
      speciesId: ficha.species.id,
      zoneId: null,
      isAdoptable: true,
    });
    expect(editar.status).toBe(200);
    expect(editar.body.isAdoptable).toBe(true);
  });

  it('de trasladado a fallecido (con «En memoria») y otra vez a trasladado, que lo quita de «En memoria»', async () => {
    const fallecido = await marta
      .patch('/api/admin/animals/13/status')
      .send({ status: 'deceased', date: t.hoy, showInMemorial: true });
    expect(fallecido.status).toBe(200);
    expect(fallecido.body).toMatchObject({ status: 'deceased', statusChangedAt: t.hoy, showInMemorial: true });
    const trasladado = await marta.patch('/api/admin/animals/13/status').send({ status: 'transferred', date: t.hoy });
    expect(trasladado.status).toBe(200);
    expect(trasladado.body).toMatchObject({ status: 'transferred', showInMemorial: false, isAdoptable: false });
  });
});
