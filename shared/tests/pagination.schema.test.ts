import { describe, expect, it } from 'vitest';
import { idParamsSchema, MAX_PAGE_SIZE, paginationQuerySchema } from '../src/schemas/pagination.schema.js';

describe('paginationQuerySchema', () => {
  it('aplica página 1 y 20 elementos por defecto', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });

  it('convierte los valores de la URL a números', () => {
    expect(paginationQuerySchema.parse({ page: '3', pageSize: '12' })).toEqual({ page: 3, pageSize: 12 });
  });

  it(`no admite más de ${MAX_PAGE_SIZE} elementos por página`, () => {
    expect(paginationQuerySchema.safeParse({ pageSize: '101' }).success).toBe(false);
  });

  it('rechaza páginas no válidas', () => {
    expect(paginationQuerySchema.safeParse({ page: '0' }).success).toBe(false);
    expect(paginationQuerySchema.safeParse({ page: 'dos' }).success).toBe(false);
  });
});

describe('idParamsSchema', () => {
  it('acepta un id entero positivo', () => {
    expect(idParamsSchema.parse({ id: '7' })).toEqual({ id: 7 });
  });

  it('rechaza ids no numéricos o negativos', () => {
    expect(idParamsSchema.safeParse({ id: 'abc' }).success).toBe(false);
    expect(idParamsSchema.safeParse({ id: '-1' }).success).toBe(false);
    expect(idParamsSchema.safeParse({ id: '1.5' }).success).toBe(false);
  });
});
