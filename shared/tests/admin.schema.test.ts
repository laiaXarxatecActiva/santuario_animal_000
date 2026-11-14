import { describe, expect, it } from 'vitest';
import {
  adminUpdatesQuerySchema,
  coverBodySchema,
  photoOrderBodySchema,
  photoPatchBodySchema,
  photoUploadBodySchema,
  updateCreateBodySchema,
  updateEditBodySchema,
} from '../src/schemas/admin.schema.js';

const errores = (resultado: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  resultado.error?.issues.map((i) => ({ field: i.path.join('.'), message: i.message })) ?? [];

describe('CU-29 esquemas de fotos y vídeos', () => {
  it('3: la subida trae, en JSON, el texto alternativo y la visibilidad de cada archivo', () => {
    const meta = JSON.stringify([{ altText: '  Rufo al sol ', visibility: 'adopters' }, { altText: 'Rufo comiendo' }]);
    expect(photoUploadBodySchema.parse({ meta })).toEqual({
      meta: [
        { altText: 'Rufo al sol', visibility: 'adopters' },
        { altText: 'Rufo comiendo', visibility: 'public' },
      ],
    });
  });

  it('3a: sin texto alternativo no se puede guardar', () => {
    const meta = JSON.stringify([{ altText: 'Bien' }, { altText: '   ' }]);
    expect(errores(photoUploadBodySchema.safeParse({ meta }))).toEqual([
      { field: 'meta.1.altText', message: 'Escribe el texto alternativo.' },
    ]);
  });

  it('los metadatos que no son JSON o no son una lista dan error en el campo', () => {
    expect(errores(photoUploadBodySchema.safeParse({ meta: 'no es json' }))).toEqual([
      { field: 'meta', message: 'Faltan los datos de los archivos.' },
    ]);
    expect(errores(photoUploadBodySchema.safeParse({}))).toEqual([
      { field: 'meta', message: 'Faltan los datos de los archivos.' },
    ]);
    expect(photoUploadBodySchema.safeParse({ meta: '{}' }).success).toBe(false);
  });

  it('el texto alternativo tiene como máximo 300 caracteres (photos.alt_text)', () => {
    const meta = JSON.stringify([{ altText: 'a'.repeat(301) }]);
    expect(errores(photoUploadBodySchema.safeParse({ meta }))).toEqual([
      { field: 'meta.0.altText', message: 'No puede tener más de 300 caracteres.' },
    ]);
  });

  it('A1: la edición cambia el texto alternativo y la visibilidad', () => {
    expect(photoPatchBodySchema.parse({ altText: ' Nuevo ', visibility: 'adopters' })).toEqual({
      altText: 'Nuevo',
      visibility: 'adopters',
    });
    expect(photoPatchBodySchema.safeParse({ altText: '', visibility: 'public' }).success).toBe(false);
    expect(photoPatchBodySchema.safeParse({ altText: 'Bien', visibility: 'secret' }).success).toBe(false);
  });

  it('5: el orden es una lista de ids y la portada un id', () => {
    expect(photoOrderBodySchema.parse({ photoIds: [3, 1, 2] })).toEqual({ photoIds: [3, 1, 2] });
    expect(photoOrderBodySchema.safeParse({ photoIds: [] }).success).toBe(false);
    expect(photoOrderBodySchema.safeParse({ photoIds: [1, 'x'] }).success).toBe(false);
    expect(coverBodySchema.parse({ photoId: 4 })).toEqual({ photoId: 4 });
    expect(coverBodySchema.safeParse({ photoId: 0 }).success).toBe(false);
  });
});

describe('CU-31 y CU-32 esquemas de las actualizaciones', () => {
  it('CU-31 2: animal, título, texto y visibilidad (por defecto, solo adoptantes); en multipart llegan como texto', () => {
    expect(
      updateCreateBodySchema.parse({
        animalId: '3',
        title: ' Turia y la lluvia ',
        body: 'Le encanta.',
        meta: JSON.stringify([{ altText: 'Turia mojada' }]),
      }),
    ).toEqual({
      animalId: 3,
      title: 'Turia y la lluvia',
      body: 'Le encanta.',
      visibility: 'adopters',
      meta: [{ altText: 'Turia mojada' }],
    });
  });

  it('CU-31: también se acepta JSON, sin archivos', () => {
    expect(updateCreateBodySchema.parse({ animalId: 1, title: 'Hola', body: 'Texto', visibility: 'public' })).toEqual({
      animalId: 1,
      title: 'Hola',
      body: 'Texto',
      visibility: 'public',
      meta: [],
    });
  });

  it('CU-31 3a: título o texto vacíos dan error en el campo; sin animal también', () => {
    expect(errores(updateCreateBodySchema.safeParse({ title: ' ', body: '' }))).toEqual([
      { field: 'animalId', message: 'Elige el animal.' },
      { field: 'title', message: 'Escribe el título.' },
      { field: 'body', message: 'Escribe el texto.' },
    ]);
    expect(errores(updateCreateBodySchema.safeParse({ animalId: 1, title: 'a'.repeat(201), body: 'x' }))).toEqual([
      { field: 'title', message: 'No puede tener más de 200 caracteres.' },
    ]);
  });

  it('CU-31 2: cada archivo adjunto lleva texto alternativo', () => {
    const meta = JSON.stringify([{ altText: '' }]);
    expect(errores(updateCreateBodySchema.safeParse({ animalId: 1, title: 'a', body: 'b', meta }))).toEqual([
      { field: 'meta.0.altText', message: 'Escribe el texto alternativo.' },
    ]);
  });

  it('CU-32 2: la edición no cambia el animal y puede quitar fotos', () => {
    expect(
      updateEditBodySchema.parse({ title: 'T', body: 'B', visibility: 'public', removePhotoIds: '[19, 20]' }),
    ).toEqual({ title: 'T', body: 'B', visibility: 'public', meta: [], removePhotoIds: [19, 20] });
    expect(updateEditBodySchema.parse({ title: 'T', body: 'B' })).toMatchObject({ removePhotoIds: [] });
    expect(updateEditBodySchema.safeParse({ title: 'T', body: 'B', removePhotoIds: '[0]' }).success).toBe(false);
  });

  it('el listado se filtra por animal, visibilidad y autor', () => {
    expect(adminUpdatesQuerySchema.parse({ animalId: '1', visibility: 'public', authorId: '3' })).toMatchObject({
      animalId: 1,
      visibility: 'public',
      authorId: 3,
      page: 1,
    });
    expect(adminUpdatesQuerySchema.safeParse({ visibility: 'secret' }).success).toBe(false);
  });
});
