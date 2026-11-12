import { describe, expect, it } from 'vitest';
import {
  countByAnimal,
  countFeed,
  isVisibleToAdopter,
  listByAnimal,
  listFeed,
  mapRow,
} from '../../src/models/animal-update.model.js';
import { usarBaseDeDatos } from '../helpers/db-fixture.js';

const db = usarBaseDeDatos();
const LUCIA = 6;
const ELENA = 8;
const todo = { limit: 100, offset: 0 };

describe('animal-update.model', () => {
  it('mapRow convierte la fecha de publicación a ISO 8601 y deja isRead solo si se pidió', () => {
    const fila = {
      id: 1,
      title: 'T',
      body: 'B',
      visibility: 'public' as const,
      published_at: new Date('2026-11-01T10:00:00Z'),
    };
    expect(mapRow(fila).publishedAt).toBe('2026-11-01T10:00:00.000Z');
    expect(mapRow(fila)).not.toHaveProperty('isRead');
    expect(mapRow({ ...fila, is_read: false }).isRead).toBe(false);
  });

  it('CU-03: sin contenido exclusivo cuenta y lista solo las públicas', async () => {
    expect(await countByAnimal(db.pool, 1, { includeAdopters: false })).toBe(1);
    const lista = await listByAnimal(db.pool, 1, { includeAdopters: false, ...todo });
    expect(lista.map((u) => u.id)).toEqual([1]);
  });

  it('CU-16: con contenido exclusivo lista todas, las más recientes primero, con isRead del lector', async () => {
    expect(await countByAnimal(db.pool, 1, { includeAdopters: true })).toBe(2);
    const lista = await listByAnimal(db.pool, 2, { includeAdopters: true, readerId: ELENA, ...todo });
    expect(lista.map((u) => [u.id, u.isRead])).toEqual([
      [6, false],
      [5, true],
    ]);
  });

  it('pagina las actualizaciones', async () => {
    const primera = await listByAnimal(db.pool, 2, { includeAdopters: true, limit: 1, offset: 0 });
    const segunda = await listByAnimal(db.pool, 2, { includeAdopters: true, limit: 1, offset: 1 });
    expect([primera[0]?.id, segunda[0]?.id]).toEqual([6, 5]);
  });

  it('CU-17: el muro reúne las actualizaciones de los animales con adopción activa', async () => {
    // Lucía: Rufo, Sombra y Carbón activas; Faro (fallecido) cerrada.
    expect(await countFeed(db.pool, LUCIA, { unread: false })).toBe(5);
    const muro = await listFeed(db.pool, LUCIA, { unread: false }, todo);
    expect(muro.map((u) => [u.id, u.animal.name, u.isRead])).toEqual([
      [2, 'Rufo', true],
      [14, 'Carbón', false],
      [4, 'Sombra', true],
      [3, 'Sombra', true],
      [1, 'Rufo', true],
    ]);
    expect(muro[0]?.animal.coverPhoto?.id).toBe(1);
  });

  it('CU-17 3: filtra por no leídas y por animal', async () => {
    expect(await countFeed(db.pool, LUCIA, { unread: true })).toBe(1);
    expect((await listFeed(db.pool, LUCIA, { unread: true }, todo)).map((u) => u.id)).toEqual([14]);
    expect((await listFeed(db.pool, LUCIA, { unread: false, animalId: 8 }, todo)).map((u) => u.id)).toEqual([4, 3]);
  });

  it('CU-17 nota: el muro solo muestra lo publicado desde el inicio de la adopción', async () => {
    // Lucía adopta a Carbón desde hace 20 días.
    await db.pool.query(
      `INSERT INTO animal_updates (animal_id, author_id, title, body, visibility, published_at)
       VALUES (10, 3, 'Antes de Lucía', 'Texto', 'adopters', NOW() - INTERVAL '30 days')`,
    );
    const muro = await listFeed(db.pool, LUCIA, { unread: false, animalId: 10 }, todo);
    expect(muro.map((u) => u.title)).toEqual(['Carbón respira mejor']);
  });

  it('RN-15: una adopción pausada no da acceso a las actualizaciones', async () => {
    // Elena: Greta activa; Lupe pausada.
    expect((await listFeed(db.pool, ELENA, { unread: false }, todo)).map((u) => u.id)).toEqual([6, 5]);
    expect(await isVisibleToAdopter(db.pool, ELENA, 6)).toBe(true);
    expect(await isVisibleToAdopter(db.pool, ELENA, 7)).toBe(false);
    expect(await isVisibleToAdopter(db.pool, ELENA, 9999)).toBe(false);
  });
});
