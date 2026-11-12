import { describe, expect, it } from 'vitest';
import { listByUpdates, listGallery, mapCover, mapRow } from '../../src/models/photo.model.js';
import { usarBaseDeDatos } from '../helpers/db-fixture.js';

const db = usarBaseDeDatos();
const publicas = { includeAdopters: false };
const todas = { includeAdopters: true };

describe('photo.model', () => {
  it('mapRow pasa a camelCase', () => {
    expect(
      mapRow({
        id: 1,
        media_type: 'video',
        url: '/a.mp4',
        thumbnail_url: null,
        alt_text: 'Vídeo',
        visibility: 'adopters',
      }),
    ).toEqual({
      id: 1,
      mediaType: 'video',
      url: '/a.mp4',
      thumbnailUrl: null,
      altText: 'Vídeo',
      visibility: 'adopters',
    });
  });

  it('mapCover devuelve null si el animal no tiene portada pública', () => {
    const vacia = {
      cover_id: null,
      cover_media_type: null,
      cover_url: null,
      cover_thumbnail_url: null,
      cover_alt_text: null,
    };
    expect(mapCover(vacia)).toBeNull();
    expect(mapCover({ ...vacia, cover_id: 3, cover_url: '/c.jpg', cover_alt_text: 'Turia' })).toEqual({
      id: 3,
      mediaType: 'image',
      url: '/c.jpg',
      thumbnailUrl: null,
      altText: 'Turia',
      visibility: 'public',
    });
  });

  it('la galería respeta sort_order', async () => {
    await db.pool.query('UPDATE photos SET sort_order = 5 WHERE id = 1');
    expect((await listGallery(db.pool, 1, publicas)).map((p) => p.id)).toEqual([16, 1]);
  });

  it('RN-15: la galería incluye las fotos exclusivas solo si se piden', async () => {
    expect((await listGallery(db.pool, 1, todas)).map((p) => p.id)).toEqual([16, 17, 1]);
  });

  it('sin actualizaciones no consulta nada', async () => {
    expect((await listByUpdates(db.pool, [], publicas)).size).toBe(0);
  });

  it('agrupa por actualización; sin acceso exclusivo, solo las fotos públicas', async () => {
    expect((await listByUpdates(db.pool, [2, 6], publicas)).size).toBe(0);
    const fotos = await listByUpdates(db.pool, [2, 6], todas);
    expect([...fotos.keys()].sort()).toEqual([2, 6]);
    expect(fotos.get(2)?.map((p) => p.id)).toEqual([19]);
  });
});
