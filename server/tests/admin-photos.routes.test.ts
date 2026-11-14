import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { entrarComo, type Agente } from './helpers/sesion.js';
import { existeSubida, jpeg, mp4, prepararAppConSubidas, type TestAppConSubidas } from './helpers/test-uploads.js';

let t: TestAppConSubidas;
let nuria: Agente;
let marta: Agente;
beforeAll(async () => {
  t = await prepararAppConSubidas();
  nuria = await entrarComo(t.app, 'nuria');
  marta = await entrarComo(t.app, 'marta');
});
afterAll(() => t.cerrar());

interface Archivo {
  buffer: Buffer;
  filename: string;
  contentType: string;
}
type Meta = { altText: string; visibility?: 'public' | 'adopters' };

const MB = 1024 * 1024;
const foto = async (filename = 'foto.jpg', width = 2000, height = 1000): Promise<Archivo> => ({
  buffer: await jpeg(width, height),
  filename,
  contentType: 'image/jpeg',
});
const video = (filename = 'video.mp4'): Archivo => ({ buffer: mp4(), filename, contentType: 'video/mp4' });

function subir(agente: Agente, animalId: number, archivos: Archivo[], meta: Meta[] | string) {
  let req = agente
    .post(`/api/admin/animals/${animalId}/photos`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .field('meta', typeof meta === 'string' ? meta : JSON.stringify(meta));
  for (const a of archivos) req = req.attach('files', a.buffer, { filename: a.filename, contentType: a.contentType });
  return req;
}

const galeria = async (animalId: number) =>
  (await nuria.get(`/api/admin/animals/${animalId}/photos`)).body.data as {
    id: number;
    sortOrder: number;
    isCover: boolean;
    url: string;
    thumbnailUrl: string | null;
  }[];

describe('CU-29 Gestionar fotos y vídeos: galería', () => {
  it('1: lista las fotos de la galería en su orden, con la portada marcada y sin las de actualizaciones', async () => {
    const res = await nuria.get('/api/admin/animals/1/photos');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      expect.objectContaining({ id: 1, sortOrder: 0, isCover: true, visibility: 'public', mediaType: 'image' }),
      expect.objectContaining({ id: 16, sortOrder: 1, isCover: false, visibility: 'public' }),
      expect.objectContaining({ id: 17, sortOrder: 2, isCover: false, visibility: 'adopters' }),
    ]);
    expect(res.body.data[0]).toMatchObject({
      url: '/uploads/animals/1/cover.jpg',
      thumbnailUrl: '/uploads/animals/1/thumb_cover.jpg',
      altText: 'Rufo, buitre leonado, posado en una rampa de madera',
    });
    expect((await nuria.get('/api/admin/animals/999/photos')).status).toBe(404);
  });

  it('RN-18: sin sesión 401 y un adoptante 403 en todas las rutas', async () => {
    const lucia = await entrarComo(t.app, 'lucia');
    expect((await request(t.app).get('/api/admin/animals/1/photos')).status).toBe(401);
    expect((await lucia.get('/api/admin/animals/1/photos')).status).toBe(403);
    expect((await subir(lucia, 1, [await foto()], [{ altText: 'x' }])).status).toBe(403);
    expect((await lucia.patch('/api/admin/photos/16').send({ altText: 'x', visibility: 'public' })).status).toBe(403);
    expect((await lucia.put('/api/admin/animals/1/photos/order').send({ photoIds: [1, 16, 17] })).status).toBe(403);
    expect((await lucia.put('/api/admin/animals/1/cover').send({ photoId: 16 })).status).toBe(403);
    expect((await lucia.delete('/api/admin/photos/16').send({})).status).toBe(403);
  });
});

describe('CU-29 Gestionar fotos y vídeos: subida', () => {
  it('2-4: sube imágenes (redimensionadas y con miniatura) y vídeos, al final de la galería', async () => {
    const res = await subir(
      nuria,
      3,
      [await foto('turia.jpg'), video('turia.mp4')],
      [
        { altText: 'Turia al sol', visibility: 'public' },
        { altText: 'Vídeo de Turia', visibility: 'adopters' },
      ],
    );
    expect(res.status).toBe(201);
    expect(res.body.rejected).toEqual([]);
    const [imagen, vid] = res.body.created;
    expect(imagen).toMatchObject({
      mediaType: 'image',
      altText: 'Turia al sol',
      visibility: 'public',
      sortOrder: 1,
      isCover: false,
    });
    expect(imagen.url).toMatch(/^\/uploads\/animals\/3\/[0-9a-f-]{36}\.webp$/);
    expect(imagen.thumbnailUrl).toBe(imagen.url.replace(/\.webp$/, '_thumb.webp'));
    expect(vid).toMatchObject({
      mediaType: 'video',
      altText: 'Vídeo de Turia',
      visibility: 'adopters',
      sortOrder: 2,
      thumbnailUrl: null,
    });
    expect(vid.url).toMatch(/^\/uploads\/animals\/3\/[0-9a-f-]{36}\.mp4$/);

    // Los archivos se guardan y se sirven en /uploads.
    const grande = await request(t.app).get(imagen.url);
    expect(grande.status).toBe(200);
    expect(await sharp(grande.body as Buffer).metadata()).toMatchObject({ format: 'webp', width: 1600 });
    const mini = await request(t.app).get(imagen.thumbnailUrl);
    expect(await sharp(mini.body as Buffer).metadata()).toMatchObject({ width: 400 });
    expect(await existeSubida(t.uploadsDir, vid.url)).toBe(true);

    expect((await galeria(3)).map((f) => f.id)).toEqual([3, imagen.id, vid.id]);
    const { rows } = await t.pool.query<{ uploaded_by: number }>('SELECT uploaded_by FROM photos WHERE id = $1', [
      imagen.id,
    ]);
    expect(rows[0]?.uploaded_by).toBe(3); // Nuria
  });

  it('2a: rechaza los archivos con formato o tamaño no permitido y sube los demás', async () => {
    const res = await subir(
      nuria,
      4,
      [
        { buffer: Buffer.from('GIF89a'), filename: 'animado.gif', contentType: 'image/gif' },
        await foto('olmo.jpg'),
        { buffer: Buffer.alloc(5 * MB + 1), filename: 'enorme.jpg', contentType: 'image/jpeg' },
        { buffer: Buffer.from('no soy una imagen'), filename: 'falsa.png', contentType: 'image/png' },
      ],
      [{ altText: 'Gif' }, { altText: 'Olmo en su recinto' }, { altText: 'Enorme' }, { altText: 'Falsa' }],
    );
    expect(res.status).toBe(201);
    expect(res.body.created).toHaveLength(1);
    expect(res.body.created[0]).toMatchObject({ altText: 'Olmo en su recinto', visibility: 'public' });
    expect(res.body.rejected).toEqual([
      {
        fileName: 'animado.gif',
        code: 'UNSUPPORTED_FORMAT',
        message: 'Formato no permitido: solo JPEG, PNG, WebP o MP4.',
      },
      { fileName: 'enorme.jpg', code: 'IMAGE_TOO_LARGE', message: 'La imagen supera los 5 MB.' },
      {
        fileName: 'falsa.png',
        code: 'INVALID_FILE',
        message: 'El archivo está dañado o no corresponde a su formato.',
      },
    ]);
  });

  it('2a: si se rechazan todos, no se crea nada y responde 200', async () => {
    const res = await subir(
      nuria,
      4,
      [{ buffer: Buffer.from('GIF89a'), filename: 'animado.gif', contentType: 'image/gif' }],
      [{ altText: 'Gif' }],
    );
    expect(res.status).toBe(200);
    expect(res.body.created).toEqual([]);
    expect(res.body.rejected).toHaveLength(1);
  });

  it('3a: sin texto alternativo no se guarda nada', async () => {
    const antes = (await galeria(5)).length;
    const res = await subir(nuria, 5, [await foto(), await foto('otra.jpg')], [{ altText: 'Bien' }, { altText: ' ' }]);
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field: 'meta.1.altText', message: 'Escribe el texto alternativo.' }]);
    expect(await galeria(5)).toHaveLength(antes);
  });

  it('los datos de cada archivo deben coincidir con los archivos enviados', async () => {
    const res = await subir(nuria, 5, [await foto()], [{ altText: 'Una' }, { altText: 'Dos' }]);
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      { field: 'meta', message: 'Indica el texto alternativo de cada archivo.' },
    ]);
  });

  it('sin archivos 400 y con más de 10 archivos 400', async () => {
    const vacio = await subir(nuria, 5, [], []);
    expect(vacio.status).toBe(400);
    expect(vacio.body.error.code).toBe('NO_FILES');

    const once = await Promise.all(Array.from({ length: 11 }, (_, i) => foto(`f${i}.jpg`, 20, 20)));
    const muchos = await subir(
      nuria,
      5,
      once,
      once.map(() => ({ altText: 'x' })),
    );
    expect(muchos.status).toBe(400);
    expect(muchos.body.error).toMatchObject({
      code: 'TOO_MANY_FILES',
      message: 'Puedes subir como máximo 10 archivos a la vez.',
    });
  });

  it('TECH_SPEC §13 (CSRF): una subida sin la cabecera X-Requested-With da 415', async () => {
    const res = await nuria
      .post('/api/admin/animals/5/photos')
      .field('meta', JSON.stringify([{ altText: 'x' }]))
      .attach('files', await jpeg(20, 20), { filename: 'a.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(415);
  });

  it('a un animal que no existe 404', async () => {
    expect((await subir(nuria, 999, [await foto()], [{ altText: 'x' }])).status).toBe(404);
  });
});

describe('CU-29 Gestionar fotos y vídeos: edición (A1)', () => {
  it('cambia el texto alternativo y la visibilidad', async () => {
    const res = await nuria.patch('/api/admin/photos/16').send({ altText: 'Rufo comiendo', visibility: 'adopters' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 16, altText: 'Rufo comiendo', visibility: 'adopters', isCover: false });
  });

  it('la portada no puede pasar a «solo adoptantes», pero sí cambiar su texto', async () => {
    const res = await nuria.patch('/api/admin/photos/1').send({ altText: 'Rufo', visibility: 'adopters' });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({
      code: 'COVER_MUST_BE_PUBLIC',
      details: [
        { field: 'visibility', message: 'La portada no puede ser solo para adoptantes. Elige antes otra portada.' },
      ],
    });
    const texto = await nuria.patch('/api/admin/photos/1').send({ altText: 'Rufo en su rampa', visibility: 'public' });
    expect(texto.status).toBe(200);
    expect(texto.body).toMatchObject({ altText: 'Rufo en su rampa', isCover: true });
  });

  it('las fotos de una actualización se editan desde la actualización', async () => {
    const res = await nuria.patch('/api/admin/photos/19').send({ altText: 'x', visibility: 'public' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PHOTO_BELONGS_TO_UPDATE');
  });

  it('valida los datos y una foto que no existe da 404', async () => {
    expect((await nuria.patch('/api/admin/photos/16').send({ altText: '', visibility: 'public' })).status).toBe(400);
    expect((await nuria.patch('/api/admin/photos/999').send({ altText: 'x', visibility: 'public' })).status).toBe(404);
  });
});

describe('CU-29 Gestionar fotos y vídeos: orden y portada (5-6)', () => {
  it('guarda el nuevo orden de la galería', async () => {
    const res = await nuria.put('/api/admin/animals/2/photos/order').send({ photoIds: [18, 2] });
    expect(res.status).toBe(204);
    expect((await galeria(2)).map((f) => [f.id, f.sortOrder])).toEqual([
      [18, 0],
      [2, 1],
    ]);
  });

  it('el orden debe incluir todas las fotos de la galería y solo esas', async () => {
    for (const photoIds of [[18], [18, 2, 20], [18, 2, 1], [18, 2, 2]]) {
      const res = await nuria.put('/api/admin/animals/2/photos/order').send({ photoIds });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('INVALID_PHOTO_ORDER');
    }
    expect((await nuria.put('/api/admin/animals/999/photos/order').send({ photoIds: [1] })).status).toBe(404);
  });

  it('elige como portada una imagen pública de la galería', async () => {
    const subida = await subir(marta, 5, [await foto('brisa.jpg')], [{ altText: 'Brisa volando' }]);
    const nueva = subida.body.created[0].id as number;
    expect((await nuria.put('/api/admin/animals/5/cover').send({ photoId: nueva })).status).toBe(204);
    expect((await nuria.get('/api/admin/animals/5')).body.coverPhoto).toMatchObject({ id: nueva });
    expect((await request(t.app).get('/api/animals/5')).body.coverPhoto).toMatchObject({ id: nueva });
    expect((await galeria(5)).find((f) => f.id === nueva)?.isCover).toBe(true);
  });

  it('5a: un vídeo, una foto «solo adoptantes» o de otro animal no pueden ser la portada', async () => {
    const subida = await subir(
      nuria,
      5,
      [video(), await foto('privada.jpg')],
      [{ altText: 'Vídeo' }, { altText: 'Privada', visibility: 'adopters' }],
    );
    const [vid, privada] = subida.body.created as { id: number }[];
    for (const photoId of [vid!.id, privada!.id, 1]) {
      const res = await nuria.put('/api/admin/animals/5/cover').send({ photoId });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('INVALID_COVER');
    }
    expect((await nuria.put('/api/admin/animals/5/cover').send({ photoId: 999 })).status).toBe(404);
  });
});

describe('CU-29 Gestionar fotos y vídeos: borrado (A2)', () => {
  it('borra el registro y sus archivos', async () => {
    const subida = await subir(nuria, 6, [await foto('canelo.jpg')], [{ altText: 'Canelo' }]);
    const { id, url, thumbnailUrl } = subida.body.created[0];
    expect(await existeSubida(t.uploadsDir, url)).toBe(true);
    expect((await nuria.delete(`/api/admin/photos/${id}`).send({})).status).toBe(204);
    expect(await existeSubida(t.uploadsDir, url)).toBe(false);
    expect(await existeSubida(t.uploadsDir, thumbnailUrl)).toBe(false);
    expect((await galeria(6)).map((f) => f.id)).toEqual([6]);
    expect((await nuria.delete(`/api/admin/photos/${id}`).send({})).status).toBe(404);
  });

  it('si era la portada, el animal queda sin portada', async () => {
    expect((await nuria.delete('/api/admin/photos/6').send({})).status).toBe(204);
    expect((await nuria.get('/api/admin/animals/6')).body.coverPhoto).toBeNull();
  });

  it('las fotos de una actualización se borran desde la actualización', async () => {
    const res = await nuria.delete('/api/admin/photos/20').send({});
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PHOTO_BELONGS_TO_UPDATE');
  });
});
