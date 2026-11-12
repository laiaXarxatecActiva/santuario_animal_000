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
        sex: 'unknown',
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
      speciesId: 2,
      sex: 'unknown',
      minAge: 5,
      maxAge: 15,
      adoptable: true,
      q: 'rufo',
    });
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
