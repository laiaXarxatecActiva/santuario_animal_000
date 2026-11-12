import { describe, expect, it } from 'vitest';
import { restarAnios } from '../src/dominio/edad.js';
import { relojFijo } from '../src/dominio/reloj.js';
import { AnimalNotAvailableError } from '../src/errors/app-error.js';
import { createPublicCatalogService } from '../src/servicios/public-catalog.service.js';
import { usarBaseDeDatos } from './helpers/db-fixture.js';

const db = usarBaseDeDatos();

async function hoyEnBd(): Promise<string> {
  const { rows } = await db.pool.query<{ hoy: string }>('SELECT CURRENT_DATE::text AS hoy');
  return rows[0]?.hoy ?? '';
}

describe('createPublicCatalogService', () => {
  it('calcula la edad con el Reloj inyectado', async () => {
    const dentroDeUnAnio = restarAnios(await hoyEnBd(), -1);
    const service = createPublicCatalogService({ db: db.pool, reloj: relojFijo(`${dentroDeUnAnio}T12:00:00Z`) });
    expect((await service.getAnimal(1)).approxAgeYears).toBe(13);
  });

  it('el filtro de edad usa el mismo «hoy» que la edad mostrada', async () => {
    const dentroDeUnAnio = restarAnios(await hoyEnBd(), -1);
    const service = createPublicCatalogService({ db: db.pool, reloj: relojFijo(`${dentroDeUnAnio}T12:00:00Z`) });
    const { data } = await service.listCatalog({ page: 1, pageSize: 20, sort: 'name', minAge: 13, maxAge: 13 });
    expect(data.map((a) => [a.name, a.approxAgeYears])).toEqual([['Rufo', 13]]);
  });

  it('CU-03 1a: las actualizaciones de un animal no público lanzan AnimalNotAvailableError', async () => {
    const service = createPublicCatalogService({ db: db.pool, reloj: relojFijo(`${await hoyEnBd()}T12:00:00Z`) });
    await expect(service.listUpdates(12, { page: 1, pageSize: 20 })).rejects.toBeInstanceOf(AnimalNotAvailableError);
  });
});
