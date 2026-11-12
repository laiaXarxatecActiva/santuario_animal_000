import request from 'supertest';
import type { AnimalCardDto, AnimalUpdateDto, PublicAnimalDto } from '@sanctuary/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prepararApp, type TestApp } from './helpers/test-app.js';

let t: TestApp;
beforeAll(async () => {
  t = await prepararApp();
});
afterAll(() => t.pool.end());

const nombres = (animales: { name: string }[]) => animales.map((a) => a.name);
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

describe('CU-02 Consultar el catálogo de animales', () => {
  it('lista los animales publicados en el santuario o en tratamiento, primero los más recientes', async () => {
    const res = await request(t.app).get('/api/animals');
    expect(res.status).toBe(200);
    expect(nombres(res.body.data)).toEqual([
      'Carbón',
      'Olmo',
      'Roca',
      'Ébano',
      'Canelo',
      'Brisa',
      'Lupe',
      'Sombra',
      'Greta',
      'Turia',
      'Rufo',
      'Nieve',
    ]);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 12, totalPages: 1 });
  });

  it('no muestra fallecidos, trasladados ni animales sin publicar (RN-22)', async () => {
    const res = await request(t.app).get('/api/animals');
    expect(nombres(res.body.data)).not.toContain('Faro');
    expect(nombres(res.body.data)).not.toContain('Barbas');
    expect(nombres(res.body.data)).not.toContain('Pipa');
  });

  it('devuelve los datos de la tarjeta', async () => {
    const res = await request(t.app).get('/api/animals').query({ q: 'rufo' });
    const rufo: AnimalCardDto = res.body.data[0];
    expect(rufo).toEqual({
      id: 1,
      name: 'Rufo',
      species: { id: 1, name: 'Buitre leonado', scientificName: 'Gyps fulvus' },
      sex: 'male',
      status: 'in_sanctuary',
      approxAgeYears: 12,
      isAdoptable: true,
      adopterCount: 2,
      coverPhoto: {
        id: 1,
        mediaType: 'image',
        url: '/uploads/animals/1/cover.jpg',
        thumbnailUrl: '/uploads/animals/1/thumb_cover.jpg',
        altText: 'Rufo, buitre leonado, posado en una rampa de madera',
        visibility: 'public',
      },
    });
  });

  it('filtra por especie', async () => {
    const res = await request(t.app).get('/api/animals').query({ speciesId: 2 });
    expect(nombres(res.body.data)).toEqual(['Carbón', 'Ébano', 'Sombra']);
  });

  it('filtra por sexo, incluido «desconocido»', async () => {
    const res = await request(t.app).get('/api/animals').query({ sex: 'unknown' });
    expect(nombres(res.body.data)).toEqual(['Carbón', 'Canelo', 'Turia']);
  });

  it('filtra por rango de edad', async () => {
    const jovenes = await request(t.app).get('/api/animals').query({ minAge: 0, maxAge: 4 });
    expect(nombres(jovenes.body.data)).toEqual(['Canelo', 'Turia']);
    const mayores = await request(t.app).get('/api/animals').query({ minAge: 16 });
    expect(nombres(mayores.body.data)).toEqual(['Nieve']);
  });

  it('«disponible para adoptar» oculta los no adoptables', async () => {
    const res = await request(t.app).get('/api/animals').query({ adoptable: 'true' });
    expect(res.body.meta.total).toBe(11);
    expect(nombres(res.body.data)).not.toContain('Roca');
  });

  it('los no adoptables aparecen sin filtro, marcados como no adoptables', async () => {
    const res = await request(t.app).get('/api/animals').query({ q: 'roca' });
    expect(res.body.data[0]).toMatchObject({ name: 'Roca', isAdoptable: false });
  });

  it('busca por nombre sin distinguir mayúsculas ni tildes', async () => {
    const res = await request(t.app).get('/api/animals').query({ q: 'EBANO' });
    expect(nombres(res.body.data)).toEqual(['Ébano']);
  });

  it('la búsqueda trata % y _ como texto, no como comodines', async () => {
    const res = await request(t.app).get('/api/animals').query({ q: '%' });
    expect(res.body.data).toEqual([]);
  });

  it('ordena por nombre', async () => {
    const res = await request(t.app).get('/api/animals').query({ sort: 'name' });
    const lista = nombres(res.body.data);
    expect(lista).toEqual([...lista].sort((a, b) => a.localeCompare(b, 'es')));
  });

  it('ordena por menos adoptantes', async () => {
    const res = await request(t.app).get('/api/animals').query({ sort: 'adopterCount' });
    const cuentas = (res.body.data as AnimalCardDto[]).map((a) => a.adopterCount);
    expect(cuentas).toEqual([...cuentas].sort((a, b) => a - b));
    expect(nombres(res.body.data).slice(0, 4)).toEqual(['Roca', 'Canelo', 'Brisa', 'Lupe']);
  });

  it('pagina los resultados', async () => {
    const res = await request(t.app).get('/api/animals').query({ pageSize: 5, page: 2 });
    expect(nombres(res.body.data)).toEqual(['Brisa', 'Lupe', 'Sombra', 'Greta', 'Turia']);
    expect(res.body.meta).toEqual({ page: 2, pageSize: 5, total: 12, totalPages: 3 });
  });

  it('4b: una página fuera de rango devuelve la última', async () => {
    const res = await request(t.app).get('/api/animals').query({ pageSize: 5, page: 9 });
    expect(res.body.meta.page).toBe(3);
    expect(nombres(res.body.data)).toEqual(['Rufo', 'Nieve']);
  });

  it('4a: sin resultados devuelve una lista vacía', async () => {
    const res = await request(t.app).get('/api/animals').query({ q: 'nadie' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } });
  });

  it('responde 400 si un filtro no es válido', async () => {
    const res = await request(t.app).get('/api/animals').query({ sort: 'createdAt', sex: 'otro' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d: { field: string }) => d.field).sort()).toEqual(['sex', 'sort']);
  });
});

describe('CU-02 Lista de especies', () => {
  it('devuelve todas las especies por nombre', async () => {
    const res = await request(t.app).get('/api/species');
    expect(res.status).toBe(200);
    expect(res.body.data.map((s: { name: string }) => s.name)).toEqual([
      'Alimoche común',
      'Buitre leonado',
      'Buitre negro',
      'Quebrantahuesos',
    ]);
    expect(res.body.data[1]).toEqual({ id: 1, name: 'Buitre leonado', scientificName: 'Gyps fulvus' });
  });
});

describe('CU-03 Consultar la ficha pública de un animal', () => {
  it('devuelve la ficha con sus fotos públicas en orden', async () => {
    const res = await request(t.app).get('/api/animals/1');
    expect(res.status).toBe(200);
    const rufo: PublicAnimalDto = res.body;
    expect(rufo).toMatchObject({
      id: 1,
      name: 'Rufo',
      species: { name: 'Buitre leonado' },
      sex: 'male',
      approxAgeYears: 12,
      adopterCount: 2,
      isAdoptable: true,
      breed: null,
    });
    expect(rufo.arrivalDate).toMatch(FECHA);
    expect(rufo.approxBirthDate).toMatch(FECHA);
    expect(rufo.rescueStory).toEqual(expect.any(String));
    expect(rufo.photos.map((p) => p.id)).toEqual([1, 16]);
  });

  it('no incluye el resumen de salud ni las fotos para adoptantes (RN-15)', async () => {
    const res = await request(t.app).get('/api/animals/1');
    expect(res.body).not.toHaveProperty('healthSummary');
    expect(res.body.photos.map((p: { id: number }) => p.id)).not.toContain(17);
  });

  it('muestra solo los nombres de los adoptantes activos que lo han permitido (RN-16)', async () => {
    const res = await request(t.app).get('/api/animals/1');
    expect(res.body.publicAdopterNames).toEqual(['Lucía']);
  });

  it('3a: un animal sin adoptantes', async () => {
    const res = await request(t.app).get('/api/animals/5');
    expect(res.body).toMatchObject({ name: 'Brisa', adopterCount: 0, publicAdopterNames: [] });
  });

  it('5a: un animal no adoptable se marca como tal', async () => {
    const res = await request(t.app).get('/api/animals/15');
    expect(res.body).toMatchObject({ name: 'Roca', isAdoptable: false });
  });

  it.each([
    [12, 'fallecido'],
    [13, 'trasladado'],
    [14, 'sin publicar'],
    [999, 'inexistente'],
  ])('1a: el animal %i (%s) no está disponible', async (id) => {
    const res = await request(t.app).get(`/api/animals/${id}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({
      code: 'ANIMAL_NOT_AVAILABLE',
      message: 'Este animal no está disponible.',
      details: [],
    });
  });

  it('responde 400 si el id no es un número', async () => {
    const res = await request(t.app).get('/api/animals/abc');
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field: 'id', message: expect.any(String) }]);
  });
});

describe('CU-03 Últimas actualizaciones públicas', () => {
  it('devuelve solo las actualizaciones públicas, las más recientes primero', async () => {
    const res = await request(t.app).get('/api/animals/1/updates');
    expect(res.status).toBe(200);
    const actualizaciones: AnimalUpdateDto[] = res.body.data;
    expect(actualizaciones.map((u) => u.title)).toEqual(['Rufo estrena posadero']);
    expect(actualizaciones[0]?.visibility).toBe('public');
    expect(Date.parse(actualizaciones[0]?.publishedAt ?? '')).not.toBeNaN();
    expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 1, totalPages: 1 });
  });

  it('un animal sin actualizaciones públicas devuelve una lista vacía', async () => {
    const res = await request(t.app).get('/api/animals/2/updates');
    expect(res.body.data).toEqual([]);
  });

  it('responde 404 si el animal no es público', async () => {
    const res = await request(t.app).get('/api/animals/13/updates');
    expect(res.status).toBe(404);
  });
});

describe('CU-16 Consultar la ficha ampliada de un animal adoptado', () => {
  const entrar = async (email: string, password: string) => {
    const agent = request.agent(t.app);
    expect((await agent.post('/api/auth/login').send({ email, password })).status).toBe(200);
    return agent;
  };
  let lucia: ReturnType<typeof request.agent>;
  let elena: ReturnType<typeof request.agent>;
  let nuria: ReturnType<typeof request.agent>;
  beforeAll(async () => {
    lucia = await entrar('lucia.martinez@correo.test', 'Lucia.buitres1');
    elena = await entrar('elena.rubio@correo.test', 'elenita_88');
    nuria = await entrar('nuria.peris@santuario.test', 'NuriaPeris26#!');
  });

  it('un visitante no tiene acceso al contenido exclusivo', async () => {
    const res = await request(t.app).get('/api/animals/1');
    expect(res.body.exclusiveAccess).toBe(false);
    expect(res.body.photos.map((p: { visibility: string }) => p.visibility)).toEqual(['public', 'public']);
  });

  it('2: un adoptante activo ve el resumen de salud y las fotos exclusivas de la galería', async () => {
    const res = await lucia.get('/api/animals/1');
    expect(res.status).toBe(200);
    const rufo: PublicAnimalDto = res.body;
    expect(rufo.exclusiveAccess).toBe(true);
    expect(rufo.healthSummary).toMatch(/^Rufo está bien de salud/);
    expect(rufo.photos.map((p) => [p.id, p.visibility])).toEqual([
      [1, 'public'],
      [16, 'public'],
      [17, 'adopters'],
    ]);
  });

  it('2: un adoptante activo ve todas las actualizaciones, con sus fotos y si las ha leído', async () => {
    const res = await lucia.get('/api/animals/1/updates');
    const actualizaciones: AnimalUpdateDto[] = res.body.data;
    expect(actualizaciones.map((u) => [u.id, u.visibility, u.isRead])).toEqual([
      [2, 'adopters', true],
      [1, 'public', true],
    ]);
    expect(actualizaciones[0]?.photos.map((p) => p.id)).toEqual([19]);
    expect(res.body.meta.total).toBe(2);
  });

  it('1a: con la adopción pausada solo ve la ficha pública (TECH_SPEC §18.2)', async () => {
    const ficha = await elena.get('/api/animals/11');
    expect(ficha.body.exclusiveAccess).toBe(false);
    expect(ficha.body).not.toHaveProperty('healthSummary');
    const actualizaciones = await elena.get('/api/animals/11/updates');
    expect(actualizaciones.body.data.map((u: AnimalUpdateDto) => [u.id, u.isRead])).toEqual([[7, undefined]]);
  });

  it('un adoptante sin adopción del animal solo ve lo público', async () => {
    const res = await elena.get('/api/animals/1');
    expect(res.body.exclusiveAccess).toBe(false);
    expect(res.body.photos.map((p: { id: number }) => p.id)).toEqual([1, 16]);
  });

  it('RN-15: los trabajadores ven el contenido exclusivo, sin marcas de leído', async () => {
    const ficha = await nuria.get('/api/animals/1');
    expect(ficha.body).toMatchObject({ exclusiveAccess: true, healthSummary: expect.any(String) });
    const actualizaciones = await nuria.get('/api/animals/1/updates');
    expect(actualizaciones.body.data.map((u: AnimalUpdateDto) => [u.id, u.isRead])).toEqual([
      [2, undefined],
      [1, undefined],
    ]);
  });
});

describe('CU-04 Planes de adopción', () => {
  it('devuelve los planes activos en orden, con los importes como texto', async () => {
    const res = await request(t.app).get('/api/plans');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      { id: 1, name: 'Simbólica', monthlyAmount: '1.00', description: expect.any(String), isDefault: false },
      { id: 2, name: 'Usual', monthlyAmount: '5.00', description: expect.any(String), isDefault: true },
      { id: 3, name: 'Extraordinaria', monthlyAmount: '12.00', description: expect.any(String), isDefault: false },
    ]);
  });

  it('no incluye los planes desactivados', async () => {
    await t.pool.query('UPDATE adoption_plans SET is_active = FALSE WHERE id = 3');
    const res = await request(t.app).get('/api/plans');
    expect(res.body.data.map((p: { id: number }) => p.id)).toEqual([1, 2]);
  });
});

describe('CU-01 Consultar la página de inicio', () => {
  it('devuelve el número de animales acogidos y hasta 6 destacados', async () => {
    const res = await request(t.app).get('/api/home');
    expect(res.status).toBe(200);
    expect(res.body.shelteredCount).toBe(12);
    expect(nombres(res.body.featured)).toEqual(['Canelo', 'Brisa', 'Lupe', 'Carbón', 'Olmo', 'Ébano']);
  });

  it('los destacados son adoptables y con menos adoptantes primero', async () => {
    const res = await request(t.app).get('/api/home');
    const destacados: AnimalCardDto[] = res.body.featured;
    expect(destacados.every((a) => a.isAdoptable)).toBe(true);
    const cuentas = destacados.map((a) => a.adopterCount);
    expect(cuentas).toEqual([...cuentas].sort((a, b) => a - b));
  });

  it('2a: sin animales publicados no hay destacados', async () => {
    await t.pool.query('UPDATE animals SET is_published = FALSE');
    const res = await request(t.app).get('/api/home');
    expect(res.body).toEqual({ shelteredCount: 0, featured: [] });
  });
});
