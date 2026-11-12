import { describe, expect, it } from 'vitest';
import { countPublicByAnimal, listPublicByAnimal, mapRow } from '../../src/models/animal-update.model.js';
import { usarBaseDeDatos } from '../helpers/db-fixture.js';

const db = usarBaseDeDatos();

describe('animal-update.model', () => {
  it('mapRow convierte la fecha de publicación a ISO 8601', () => {
    const fila = {
      id: 1,
      title: 'T',
      body: 'B',
      visibility: 'public' as const,
      published_at: new Date('2026-11-01T10:00:00Z'),
    };
    expect(mapRow(fila).publishedAt).toBe('2026-11-01T10:00:00.000Z');
  });

  it('pagina las actualizaciones públicas, las más recientes primero', async () => {
    await db.pool.query("UPDATE animal_updates SET visibility = 'public' WHERE animal_id = 2");
    expect(await countPublicByAnimal(db.pool, 2)).toBe(2);
    const primera = await listPublicByAnimal(db.pool, 2, { limit: 1, offset: 0 });
    const segunda = await listPublicByAnimal(db.pool, 2, { limit: 1, offset: 1 });
    expect(Date.parse(primera[0]?.publishedAt ?? '')).toBeGreaterThan(Date.parse(segunda[0]?.publishedAt ?? ''));
  });
});
