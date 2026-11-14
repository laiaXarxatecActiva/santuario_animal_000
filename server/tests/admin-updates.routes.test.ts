import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { entrarComo, type Agente } from './helpers/sesion.js';
import { existeSubida, jpeg, prepararAppConSubidas, type TestAppConSubidas } from './helpers/test-uploads.js';

let t: TestAppConSubidas;
let nuria: Agente;
let marta: Agente;
let lucia: Agente;
beforeAll(async () => {
  t = await prepararAppConSubidas();
  nuria = await entrarComo(t.app, 'nuria');
  marta = await entrarComo(t.app, 'marta');
  lucia = await entrarComo(t.app, 'lucia');
});
afterAll(() => t.cerrar());

interface Archivo {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

const foto = async (filename = 'foto.jpg'): Promise<Archivo> => ({
  buffer: await jpeg(800, 600),
  filename,
  contentType: 'image/jpeg',
});

/** Envía una actualización en multipart, como el cliente. */
function enviar(
  agente: Agente,
  metodo: 'post' | 'put',
  url: string,
  campos: Record<string, string | number>,
  archivos: Archivo[] = [],
  meta: { altText: string }[] = archivos.map((a) => ({ altText: `Foto ${a.filename}` })),
) {
  let req = agente[metodo](url).set('X-Requested-With', 'XMLHttpRequest');
  for (const [clave, valor] of Object.entries(campos)) req = req.field(clave, String(valor));
  req = req.field('meta', JSON.stringify(meta));
  for (const a of archivos) req = req.attach('files', a.buffer, { filename: a.filename, contentType: a.contentType });
  return req;
}

const ids = (body: { data: { id: number }[] }) => body.data.map((u) => u.id);
const archivosDe = (animalId: number) => readdir(join(t.uploadsDir, 'animals', String(animalId))).catch(() => []);
const alertas = async () =>
  ((await marta.get('/api/admin/dashboard')).body.updateAlerts as { animal: { id: number }; level: string }[]).map(
    (a) => [a.animal.id, a.level],
  );

describe('CU-31 Publicar una actualización: listado y detalle', () => {
  it('lista todas las actualizaciones, las más recientes primero, con su animal y su autor', async () => {
    const res = await nuria.get('/api/admin/updates');
    expect(res.status).toBe(200);
    expect(res.body.meta).toMatchObject({ page: 1, total: 20 });
    expect(ids(res.body).slice(0, 3)).toEqual([6, 2, 14]);
    expect(res.body.data[0]).toMatchObject({
      id: 6,
      animal: { id: 2, name: 'Greta' },
      author: { id: 5, name: 'Carmen Boix Vidal' },
      title: 'Greta y su baño de sol',
      visibility: 'adopters',
      photoCount: 1,
      canEdit: false,
    });
    expect(res.body.data[1]).toMatchObject({ id: 2, author: { id: 3 }, canEdit: true });
  });

  it('filtra por animal, visibilidad y autor', async () => {
    expect(ids((await nuria.get('/api/admin/updates?animalId=1')).body)).toEqual([2, 1]);
    expect(ids((await nuria.get('/api/admin/updates?animalId=1&visibility=public')).body)).toEqual([1]);
    expect(ids((await nuria.get('/api/admin/updates?authorId=3&pageSize=100')).body)).toEqual([
      2, 7, 19, 11, 15, 1, 12,
    ]);
    expect((await nuria.get('/api/admin/updates?visibility=secret')).status).toBe(400);
  });

  it('CU-32: el administrador puede modificar cualquiera', async () => {
    const res = await marta.get('/api/admin/updates');
    expect(res.body.data.every((u: { canEdit: boolean }) => u.canEdit)).toBe(true);
  });

  it('el detalle incluye el texto y las fotos', async () => {
    const res = await nuria.get('/api/admin/updates/2');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 2,
      animal: { id: 1, name: 'Rufo' },
      author: { id: 3, name: 'Nuria Peris Gil' },
      title: 'Revisión del ala: todo en orden',
      visibility: 'adopters',
      canEdit: true,
      photos: [{ id: 19, altText: 'La veterinaria revisa el ala de Rufo', visibility: 'adopters', isCover: false }],
    });
    expect(res.body.body).toContain('muñón del ala');
    expect((await nuria.get('/api/admin/updates/999')).status).toBe(404);
  });

  it('RN-18: sin sesión 401 y un adoptante 403', async () => {
    expect((await request(t.app).get('/api/admin/updates')).status).toBe(401);
    expect((await lucia.get('/api/admin/updates')).status).toBe(403);
    expect((await lucia.get('/api/admin/updates/2')).status).toBe(403);
    expect((await lucia.post('/api/admin/updates').send({ animalId: 1, title: 'x', body: 'y' })).status).toBe(403);
    expect((await lucia.put('/api/admin/updates/2').send({ title: 'x', body: 'y' })).status).toBe(403);
    expect((await lucia.delete('/api/admin/updates/2').send({})).status).toBe(403);
  });
});

describe('CU-31 Publicar una actualización', () => {
  it('2-3 y 5: publica con fotos (solo adoptantes por defecto) y reinicia la alerta de 14 días', async () => {
    expect(await alertas()).toContainEqual([3, 'error']); // Turia lleva 16 días
    const res = await enviar(
      nuria,
      'post',
      '/api/admin/updates',
      { animalId: 3, title: 'Turia y la lluvia', body: 'Hoy ha llovido y Turia\nse ha dado un baño.' },
      [await foto('lluvia.jpg')],
      [{ altText: 'Turia mojada en su posadero' }],
    );
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      animal: { id: 3, name: 'Turia' },
      author: { id: 3, name: 'Nuria Peris Gil' },
      title: 'Turia y la lluvia',
      body: 'Hoy ha llovido y Turia\nse ha dado un baño.',
      visibility: 'adopters',
      publishedAt: t.reloj.ahora().toISOString(),
      canEdit: true,
      photoCount: 1,
    });
    const [adjunta] = res.body.photos;
    expect(adjunta).toMatchObject({
      mediaType: 'image',
      altText: 'Turia mojada en su posadero',
      visibility: 'adopters',
    });
    expect(adjunta.url).toMatch(/^\/uploads\/animals\/3\/[0-9a-f-]{36}\.webp$/);
    expect(await existeSubida(t.uploadsDir, adjunta.url)).toBe(true);

    // Las fotos de la actualización no entran en la galería del animal.
    const galeria = (await nuria.get('/api/admin/animals/3/photos')).body.data as { id: number }[];
    expect(galeria.map((f) => f.id)).not.toContain(adjunta.id);

    // Postcondición: aparece en el muro de sus adoptantes, y la alerta desaparece.
    const irene = request.agent(t.app);
    await irene.post('/api/auth/login').send({ email: 'irene.dominguez@correo.test', password: 'Irene2025ok' });
    const muro = await irene.get('/api/me/feed');
    expect(muro.body.data[0]).toMatchObject({ id: res.body.id, title: 'Turia y la lluvia', isRead: false });
    expect((await alertas()).map(([id]) => id)).not.toContain(3);
  });

  it('una actualización pública, sin fotos, se puede enviar en JSON y sale en la ficha pública', async () => {
    const res = await marta
      .post('/api/admin/updates')
      .send({ animalId: 1, title: 'Rufo saluda', body: 'Hola a todos.', visibility: 'public' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ visibility: 'public', photos: [], author: { id: 1 } });
    const publicas = await request(t.app).get('/api/animals/1/updates');
    expect(publicas.body.data[0]).toMatchObject({ id: res.body.id, title: 'Rufo saluda' });
  });

  it('3a: título o texto vacíos dan error en el campo', async () => {
    const res = await enviar(nuria, 'post', '/api/admin/updates', { animalId: 3, title: ' ', body: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      { field: 'title', message: 'Escribe el título.' },
      { field: 'body', message: 'Escribe el texto.' },
    ]);
  });

  it('el animal debe existir y no estar fallecido ni trasladado', async () => {
    const noExiste = await nuria.post('/api/admin/updates').send({ animalId: 999, title: 'x', body: 'y' });
    expect(noExiste.status).toBe(422);
    expect(noExiste.body.error.details).toEqual([{ field: 'animalId', message: 'Este animal no existe.' }]);
    for (const animalId of [12, 13]) {
      const res = await nuria.post('/api/admin/updates').send({ animalId, title: 'x', body: 'y' });
      expect(res.status).toBe(422);
      expect(res.body.error).toMatchObject({
        code: 'UPDATE_ANIMAL_ARCHIVED',
        message: 'No se pueden publicar actualizaciones de un animal fallecido o trasladado.',
      });
    }
  });

  it('si algún archivo no es válido no se publica nada ni quedan archivos', async () => {
    const antes = (await nuria.get('/api/admin/updates')).body.meta.total;
    const res = await enviar(nuria, 'post', '/api/admin/updates', { animalId: 7, title: 'Nieve', body: 'Texto' }, [
      await foto('buena.jpg'),
      { buffer: Buffer.from('GIF89a'), filename: 'mala.gif', contentType: 'image/gif' },
    ]);
    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({
      code: 'FILES_REJECTED',
      details: [{ field: 'files.1', message: 'mala.gif: Formato no permitido: solo JPEG, PNG, WebP o MP4.' }],
    });
    expect((await nuria.get('/api/admin/updates')).body.meta.total).toBe(antes);
    expect(await archivosDe(7)).toEqual([]);
  });

  it('los datos de los archivos deben coincidir con los archivos', async () => {
    const res = await enviar(
      nuria,
      'post',
      '/api/admin/updates',
      { animalId: 7, title: 'Nieve', body: 'Texto' },
      [await foto()],
      [],
    );
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      { field: 'meta', message: 'Indica el texto alternativo de cada archivo.' },
    ]);
  });
});

describe('CU-32 Editar o borrar una actualización', () => {
  it('2-3: el autor cambia el texto, la visibilidad y las fotos', async () => {
    const res = await enviar(
      nuria,
      'put',
      '/api/admin/updates/2',
      {
        title: 'Revisión del ala',
        body: 'Todo sigue en orden.',
        visibility: 'public',
        removePhotoIds: JSON.stringify([19]),
      },
      [await foto('ala.jpg')],
      [{ altText: 'El ala de Rufo' }],
    );
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 2,
      title: 'Revisión del ala',
      body: 'Todo sigue en orden.',
      visibility: 'public',
    });
    expect(res.body.photos).toHaveLength(1);
    expect(res.body.photos[0]).toMatchObject({ altText: 'El ala de Rufo', visibility: 'public' });
    const { rowCount } = await t.pool.query('SELECT 1 FROM photos WHERE id = 19');
    expect(rowCount).toBe(0);

    // Las fotos siguen la visibilidad de la actualización.
    const otra = await nuria.put('/api/admin/updates/2').send({ title: 'Revisión del ala', body: 'Bien.' });
    expect(otra.status).toBe(200);
    expect(otra.body.visibility).toBe('adopters');
    expect(otra.body.photos[0].visibility).toBe('adopters');
  });

  it('1a: un cuidador no puede modificar ni borrar la de otro trabajador', async () => {
    const editar = await nuria.put('/api/admin/updates/3').send({ title: 'x', body: 'y' });
    expect(editar.status).toBe(403);
    expect(editar.body.error.message).toBe('Solo puedes modificar tus propias actualizaciones.');
    expect((await nuria.delete('/api/admin/updates/5').send({})).status).toBe(403);
  });

  it('el administrador modifica la de cualquiera', async () => {
    const res = await marta.put('/api/admin/updates/3').send({ title: 'Sombra encuentra la comida', body: 'Bien.' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: 'Sombra encuentra la comida', author: { id: 4 } });
  });

  it('solo se pueden quitar fotos de esta actualización; una que no existe da 404', async () => {
    const res = await nuria.put('/api/admin/updates/7').send({ title: 'Lupe', body: 'y', removePhotoIds: [20] });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      { field: 'removePhotoIds', message: 'Alguna de las fotos no es de esta actualización.' },
    ]);
    expect((await nuria.put('/api/admin/updates/999').send({ title: 'x', body: 'y' })).status).toBe(404);
    expect((await nuria.put('/api/admin/updates/7').send({ title: '', body: 'y' })).status).toBe(400);
  });

  it('borrado 2: borra la actualización, sus fotos (y archivos) y sus marcas de lectura', async () => {
    const creada = await enviar(nuria, 'post', '/api/admin/updates', { animalId: 1, title: 'Para borrar', body: 'x' }, [
      await foto('borrar.jpg'),
    ]);
    const { id, photos } = creada.body as { id: number; photos: { url: string; thumbnailUrl: string }[] };
    expect((await lucia.put(`/api/me/feed/${id}/read`).send({})).status).toBe(204);

    expect((await nuria.delete(`/api/admin/updates/${id}`).send({})).status).toBe(204);
    expect((await nuria.get(`/api/admin/updates/${id}`)).status).toBe(404);
    expect(await existeSubida(t.uploadsDir, photos[0]!.url)).toBe(false);
    expect(await existeSubida(t.uploadsDir, photos[0]!.thumbnailUrl)).toBe(false);
    const lecturas = await t.pool.query('SELECT 1 FROM update_reads WHERE update_id = $1', [id]);
    expect(lecturas.rowCount).toBe(0);
    expect((await nuria.delete(`/api/admin/updates/${id}`).send({})).status).toBe(404);
  });

  it('2a: al borrar las últimas de un animal con adoptantes, el escritorio vuelve a avisar', async () => {
    expect((await alertas()).map(([id]) => id)).not.toContain(2);
    expect((await marta.delete('/api/admin/updates/6').send({})).status).toBe(204);
    expect((await marta.delete('/api/admin/updates/5').send({})).status).toBe(204);
    expect(await alertas()).toContainEqual([2, 'error']);
  });
});
