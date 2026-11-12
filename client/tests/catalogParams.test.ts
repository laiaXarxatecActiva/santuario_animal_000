import { describe, expect, it } from 'vitest';
import { countActiveFilters, readCatalogFilters, toApiQuery, writeCatalogFilters } from '../src/utils/catalogParams';

describe('CU-02 filtros del catálogo en la URL', () => {
  it('lee los filtros de la URL', () => {
    const filtros = readCatalogFilters(
      new URLSearchParams('q=ru&speciesId=2&sex=unknown&age=adult&adoptable=true&sort=name&page=3'),
    );
    expect(filtros).toEqual({
      q: 'ru',
      speciesId: 2,
      sex: 'unknown',
      age: 'adult',
      adoptable: true,
      sort: 'name',
      page: 3,
    });
  });

  it('descarta valores no válidos y aplica los valores por defecto', () => {
    const filtros = readCatalogFilters(
      new URLSearchParams('speciesId=abc&sex=otro&age=viejo&sort=-id&page=0&adoptable=si'),
    );
    expect(filtros).toEqual({ sort: '-arrivalDate', page: 1 });
  });

  it('escribe en la URL solo lo que no es por defecto', () => {
    expect(writeCatalogFilters({ sort: '-arrivalDate', page: 1 }).toString()).toBe('');
    expect(writeCatalogFilters({ speciesId: 2, adoptable: true, sort: 'name', page: 2 }).toString()).toBe(
      'speciesId=2&adoptable=true&sort=name&page=2',
    );
  });

  it('convierte el rango de edad en minAge y maxAge para la API', () => {
    expect(toApiQuery({ age: 'young', sort: '-arrivalDate', page: 1 }, 12)).toEqual({
      minAge: 0,
      maxAge: 4,
      sort: '-arrivalDate',
      page: 1,
      pageSize: 12,
    });
    expect(toApiQuery({ age: 'senior', sort: 'name', page: 1 }, 12)).toMatchObject({ minAge: 16 });
    expect(toApiQuery({ age: 'senior', sort: 'name', page: 1 }, 12)).not.toHaveProperty('maxAge');
  });

  it('cuenta los filtros activos (el orden y la página no cuentan)', () => {
    expect(countActiveFilters({ sort: 'name', page: 4 })).toBe(0);
    expect(countActiveFilters({ q: 'ru', sex: 'male', adoptable: true, sort: 'name', page: 1 })).toBe(3);
  });
});
