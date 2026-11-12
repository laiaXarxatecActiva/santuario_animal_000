import { describe, expect, it } from 'vitest';
import { listPublicByUpdates, listPublicGallery, mapRow } from '../../src/models/photo.model.js';
import { usarBaseDeDatos } from '../helpers/db-fixture.js';

const db = usarBaseDeDatos();

describe('photo.model', () => {
  it('mapRow pasa a camelCase', () => {
    expect(mapRow({ id: 1, media_type: 'video', url: '/a.mp4', thumbnail_url: null, alt_text: 'Vídeo' })).toEqual({
      id: 1,
      mediaType: 'video',
      url: '/a.mp4',
      thumbnailUrl: null,
      altText: 'Vídeo',
    });
  });

  it('la galería pública respeta sort_order', async () => {
    await db.pool.query('UPDATE photos SET sort_order = 5 WHERE id = 1');
    expect((await listPublicGallery(db.pool, 1)).map((p) => p.id)).toEqual([16, 1]);
  });

  it('sin actualizaciones no consulta nada', async () => {
    expect((await listPublicByUpdates(db.pool, [])).size).toBe(0);
  });

  it('agrupa por actualización solo las fotos públicas', async () => {
    await db.pool.query("UPDATE photos SET visibility = 'public' WHERE id = 19");
    const fotos = await listPublicByUpdates(db.pool, [2, 6]);
    expect([...fotos.keys()]).toEqual([2]);
    expect(fotos.get(2)?.map((p) => p.id)).toEqual([19]);
  });
});
