import { describe, expect, it } from 'vitest';
import {
  coverBodySchema,
  photoOrderBodySchema,
  photoPatchBodySchema,
  photoUploadBodySchema,
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
