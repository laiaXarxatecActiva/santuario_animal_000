import { describe, expect, it } from 'vitest';
import { countPublic, findPublicById, listPublic } from '../../src/models/animal.model.js';
import { usarBaseDeDatos } from '../helpers/db-fixture.js';

const db = usarBaseDeDatos();

describe('animal.model (web pública)', () => {
  it('cuenta los animales públicos con y sin filtros', async () => {
    expect(await countPublic(db.pool)).toBe(12);
    expect(await countPublic(db.pool, { speciesId: 3 })).toBe(1);
  });

  it('filtra por límites de fecha de nacimiento', async () => {
    const animales = await listPublic(
      db.pool,
      { bornOnOrBefore: '2015-01-01' },
      { sort: 'name', limit: 20, offset: 0 },
    );
    expect(animales.map((a) => a.name).sort()).toEqual(['Nieve', 'Rufo']);
  });

  it('un animal sin fecha de nacimiento no aparece si se filtra por edad', async () => {
    await db.pool.query('UPDATE animals SET approx_birth_date = NULL WHERE id = 7');
    const animales = await listPublic(
      db.pool,
      { bornOnOrBefore: '2015-01-01' },
      { sort: 'name', limit: 20, offset: 0 },
    );
    expect(animales.map((a) => a.name)).toEqual(['Rufo']);
  });

  it('busca texto con barra invertida sin romper la consulta', async () => {
    expect(await countPublic(db.pool, { q: '\\' })).toBe(0);
  });

  it('no expone la portada si después se marca solo para adoptantes', async () => {
    // Un trigger impide elegir como portada una foto no pública, pero la foto
    // puede cambiar de visibilidad más tarde.
    await db.pool.query("UPDATE photos SET visibility = 'adopters' WHERE id = 1");
    const rufo = await findPublicById(db.pool, 1);
    expect(rufo?.coverPhoto).toBeNull();
  });

  it('devuelve null si el animal no es público', async () => {
    expect(await findPublicById(db.pool, 14)).toBeNull();
  });
});
