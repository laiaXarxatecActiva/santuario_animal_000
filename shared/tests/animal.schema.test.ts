import { describe, expect, it } from 'vitest';
import { catalogQuerySchema } from '../src/schemas/animal.schema.js';

describe('CU-02 catalogQuerySchema', () => {
  it('por defecto ordena por los más recientes', () => {
    expect(catalogQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20, sort: '-arrivalDate' });
  });

  it('convierte los filtros de la URL', () => {
    expect(
      catalogQuerySchema.parse({
        speciesId: '2',
        sex: 'female',
        minAge: '5',
        maxAge: '15',
        adoptable: 'true',
        q: '  rufo ',
        sort: 'adopterCount',
      }),
    ).toEqual({
      page: 1,
      pageSize: 20,
      sort: 'adopterCount',
      speciesId: [2],
      sex: 'female',
      minAge: 5,
      maxAge: 15,
      adoptable: true,
      q: 'rufo',
    });
  });

  it('admite varias especies separadas por comas, sin repetidas', () => {
    expect(catalogQuerySchema.parse({ speciesId: '1,2' }).speciesId).toEqual([1, 2]);
    expect(catalogQuerySchema.parse({ speciesId: '3' }).speciesId).toEqual([3]);
    expect(catalogQuerySchema.parse({ speciesId: '2,2,1' }).speciesId).toEqual([2, 1]);
    for (const speciesId of ['1,abc', '0', '1,,2', '', '-1']) {
      expect(catalogQuerySchema.safeParse({ speciesId }).success, speciesId).toBe(false);
    }
  });

  it('admite varios tramos de edad separados por comas', () => {
    expect(catalogQuerySchema.parse({ age: 'young,senior' }).age).toEqual(['young', 'senior']);
    expect(catalogQuerySchema.safeParse({ age: 'young,baby' }).success).toBe(false);
    expect(catalogQuerySchema.safeParse({ age: '' }).success).toBe(false);
  });

  it('el sexo solo puede ser macho o hembra', () => {
    expect(catalogQuerySchema.safeParse({ sex: 'unknown' }).success).toBe(false);
  });

  it('ignora una búsqueda vacía', () => {
    expect(catalogQuerySchema.parse({ q: '   ' }).q).toBeUndefined();
  });

  it('acepta adoptable=false', () => {
    expect(catalogQuerySchema.parse({ adoptable: 'false' }).adoptable).toBe(false);
  });

  it('solo admite los campos de ordenación de la lista blanca', () => {
    expect(catalogQuerySchema.safeParse({ sort: 'createdAt' }).success).toBe(false);
    expect(catalogQuerySchema.safeParse({ sort: 'name; DROP TABLE animals' }).success).toBe(false);
  });

  it('rechaza un sexo desconocido', () => {
    expect(catalogQuerySchema.safeParse({ sex: 'otro' }).success).toBe(false);
  });

  it('rechaza una edad mínima mayor que la máxima, señalando el campo', () => {
    const result = catalogQuerySchema.safeParse({ minAge: '10', maxAge: '5' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['maxAge']);
  });

  it('rechaza parámetros repetidos', () => {
    expect(catalogQuerySchema.safeParse({ sex: ['male', 'female'] }).success).toBe(false);
  });
});
