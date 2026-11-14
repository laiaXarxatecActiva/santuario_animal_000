import type { AdoptionDto, AnimalCardDto, FeedResponse } from '@sanctuary/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { tokenDelEmail } from './helpers/test-app.js';
import { entrarComo, type Agente } from './helpers/sesion.js';
import { jpeg, prepararAppConSubidas, type TestAppConSubidas } from './helpers/test-uploads.js';

// Recorridos de los criterios de aceptación de la Fase 1 (TECH_SPEC §16), de
// principio a fin y solo a través de la API, como lo haría el cliente.

let t: TestAppConSubidas;
beforeAll(async () => {
  t = await prepararAppConSubidas();
});
afterAll(() => t.cerrar());

const PLANES = [1, 2, 3] as const;

async function adoptablesPublicos(): Promise<AnimalCardDto[]> {
  const res = await request(t.app).get('/api/animals').query({ pageSize: 100 });
  expect(res.status).toBe(200);
  return (res.body.data as AnimalCardDto[]).filter((a) => a.isAdoptable);
}

async function adoptarYPagar(agente: Agente, animalId: number, planId: number): Promise<void> {
  const creada = await agente.post('/api/adoptions').send({ animalId, planId });
  expect(creada.status).toBe(201);
  const pago = await agente.post(`/api/me/adoptions/${creada.body.id}/pay`).send({});
  expect(pago.status).toBe(200);
}

describe('Fase 1: un visitante se registra, verifica el email y adopta (CU-07, CU-08, CU-13, CU-14, CU-15)', () => {
  it('adopta un buitre con cada uno de los tres planes y los ve en «Mis animales»', async () => {
    const visitante = request.agent(t.app);
    const email = 'recorrido@correo.test';
    const registro = await visitante.post('/api/auth/register').send({
      firstName: 'Rocío',
      lastName: 'Recorrido Pérez',
      email,
      password: 'buitres-2026',
      passwordConfirm: 'buitres-2026',
      privacyAccepted: true,
    });
    expect(registro.status).toBe(201);

    const animales = await adoptablesPublicos();
    expect(animales.length).toBeGreaterThanOrEqual(PLANES.length);

    // Sin verificar el email todavía no puede adoptar (RN-21).
    const antes = await visitante.post('/api/adoptions').send({ animalId: animales[0]?.id, planId: 2 });
    expect(antes.status).toBe(403);

    const verificado = await request(t.app)
      .post('/api/auth/verify-email')
      .send({ token: tokenDelEmail(t.mailer, email) });
    expect(verificado.status).toBe(200);

    for (const [i, planId] of PLANES.entries()) {
      await adoptarYPagar(visitante, animales[i]?.id ?? 0, planId);
    }

    const mias = await visitante.get('/api/me/adoptions');
    expect(mias.status).toBe(200);
    const adopciones = mias.body.data as AdoptionDto[];
    expect(adopciones.map((a) => [a.animal.id, a.plan.id, a.status]).sort()).toEqual(
      PLANES.map((planId, i) => [animales[i]?.id, planId, 'active']).sort(),
    );
  });
});

describe('Fase 1: un cuidador da de alta un buitre y escribe a sus adoptantes (CU-28, CU-29, CU-31, CU-17)', () => {
  it('lo crea con fotos, lo publica y su actualización aparece en el muro de quien lo adopta', async () => {
    const nuria = await entrarComo(t.app, 'nuria');
    const datos = {
      name: 'Recorrida',
      speciesId: 1,
      breed: '',
      sex: 'female',
      approxBirthDate: '2021-04-01',
      arrivalDate: t.hoy,
      rescueStory: 'Llegó con un ala lesionada.',
      temperament: '',
      specialNeeds: '',
      healthSummary: 'Recuperada.',
      isAdoptable: false,
      isPublished: false,
    };
    const alta = await nuria.post('/api/admin/animals').send(datos);
    expect(alta.status).toBe(201);
    const id = alta.body.id as number;
    expect((await request(t.app).get(`/api/animals/${id}`)).status).toBe(404);

    const subida = await nuria
      .post(`/api/admin/animals/${id}/photos`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .field('meta', JSON.stringify([{ altText: 'Recorrida en su voladero' }]))
      .attach('files', await jpeg(1200, 800), { filename: 'recorrida.jpg', contentType: 'image/jpeg' });
    expect(subida.status).toBe(201);
    // CU-29 paso 5: el trabajador elige la portada.
    const galeria = (await nuria.get(`/api/admin/animals/${id}/photos`)).body.data as { id: number }[];
    const portada = await nuria.put(`/api/admin/animals/${id}/cover`).send({ photoId: galeria[0]?.id });
    expect(portada.status).toBe(204);

    const publicado = await nuria
      .put(`/api/admin/animals/${id}`)
      .send({ ...datos, isAdoptable: true, isPublished: true });
    expect(publicado.status).toBe(200);
    const ficha = await request(t.app).get(`/api/animals/${id}`);
    expect(ficha.status).toBe(200);
    expect(ficha.body.coverPhoto).not.toBeNull();

    const lucia = await entrarComo(t.app, 'lucia');
    await adoptarYPagar(lucia, id, 2);

    const actualizacion = await nuria
      .post('/api/admin/updates')
      .send({ animalId: id, title: 'Primer vuelo', body: 'Hoy ha volado de un extremo a otro.' });
    expect(actualizacion.status).toBe(201);

    const muro = (await lucia.get('/api/me/feed')).body as FeedResponse;
    expect(muro.data[0]).toMatchObject({
      id: actualizacion.body.id,
      title: 'Primer vuelo',
      animal: { id, name: 'Recorrida' },
      isRead: false,
    });

    // Quien no lo ha adoptado no la ve.
    const ajeno = request.agent(t.app);
    await ajeno.post('/api/auth/login').send({ email: 'pablo.garcia@correo.test', password: 'Pablo2024!' });
    const muroAjeno = (await ajeno.get('/api/me/feed')).body as FeedResponse;
    expect(muroAjeno.data.map((u) => u.id)).not.toContain(actualizacion.body.id);
  });
});
