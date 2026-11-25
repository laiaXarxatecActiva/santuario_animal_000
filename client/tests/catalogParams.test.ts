import { describe, expect, it } from 'vitest';
import { countActiveFilters, readCatalogFilters, toApiQuery, writeCatalogFilters } from '../src/utils/catalogParams';

describe('CU-02 filtros del catálogo en la URL', () => {
  it('lee los filtros de la URL', () => {
    const filtros = readCatalogFilters(
      new URLSearchParams('q=ru&speciesId=2&sex=female&age=adult&adoptable=true&sort=name&page=3'),
    );
    expect(filtros).toEqual({
      q: 'ru',
      speciesIds: [2],
      sex: 'female',
      ages: ['adult'],
      adoptable: true,
      sort: 'name',
      page: 3,
    });
  });

  it('lee varias especies y varios tramos de edad separados por comas', () => {
    const filtros = readCatalogFilters(new URLSearchParams('speciesId=1,2&age=young,senior'));
    expect(filtros.speciesIds).toEqual([1, 2]);
    expect(filtros.ages).toEqual(['young', 'senior']);
  });

  it('de una lista descarta solo los valores no válidos y los repetidos', () => {
    const filtros = readCatalogFilters(new URLSearchParams('speciesId=2,abc,2,0&age=young,viejo'));
    expect(filtros.speciesIds).toEqual([2]);
    expect(filtros.ages).toEqual(['young']);
  });

  it('el sexo «desconocido» ya no existe: se descarta', () => {
    expect(readCatalogFilters(new URLSearchParams('sex=unknown')).sex).toBeUndefined();
  });

  it('descarta valores no válidos y aplica los valores por defecto', () => {
    const filtros = readCatalogFilters(
      new URLSearchParams('speciesId=abc&sex=otro&age=viejo&sort=-id&page=0&adoptable=si'),
    );
    expect(filtros).toEqual({ sort: '-arrivalDate', page: 1 });
  });

  it('escribe en la URL solo lo que no es por defecto, con las listas separadas por comas', () => {
    expect(writeCatalogFilters({ sort: '-arrivalDate', page: 1 }).toString()).toBe('');
    expect(writeCatalogFilters({ speciesIds: [], ages: [], sort: '-arrivalDate', page: 1 }).toString()).toBe('');
    expect(
      decodeURIComponent(
        writeCatalogFilters({
          speciesIds: [2, 1],
          ages: ['young', 'senior'],
          adoptable: true,
          sort: 'name',
          page: 2,
        }).toString(),
      ),
    ).toBe('speciesId=2,1&age=young,senior&adoptable=true&sort=name&page=2');
  });

  it('pasa las especies y los tramos de edad a la API como listas separadas por comas', () => {
    expect(toApiQuery({ speciesIds: [1, 2], ages: ['young', 'senior'], sort: '-arrivalDate', page: 1 }, 12)).toEqual({
      speciesId: '1,2',
      age: 'young,senior',
      sort: '-arrivalDate',
      page: 1,
      pageSize: 12,
    });
    expect(toApiQuery({ speciesIds: [], ages: [], sort: 'name', page: 1 }, 12)).toEqual({
      sort: 'name',
      page: 1,
      pageSize: 12,
    });
  });

  it('cuenta los filtros activos: cada especie y cada tramo de edad cuentan (el orden y la página, no)', () => {
    expect(countActiveFilters({ sort: 'name', page: 4 })).toBe(0);
    expect(countActiveFilters({ q: 'ru', sex: 'male', adoptable: true, sort: 'name', page: 1 })).toBe(3);
    expect(countActiveFilters({ speciesIds: [1, 2], ages: ['young'], sort: 'name', page: 1 })).toBe(3);
  });
});
