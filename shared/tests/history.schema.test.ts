import { describe, expect, it } from 'vitest';
import { HISTORY_PAGE_SIZE, historyQuerySchema } from '../src/schemas/history.schema.js';

describe('CU-15 historyQuerySchema', () => {
  it('por defecto, la primera página de 10 sucesos de todos los animales', () => {
    expect(HISTORY_PAGE_SIZE).toBe(10);
    expect(historyQuerySchema.parse({})).toEqual({ page: 1, pageSize: 10 });
  });

  it('convierte los filtros de la URL', () => {
    expect(historyQuerySchema.parse({ animalId: '3', page: '2', pageSize: '5' })).toEqual({
      page: 2,
      pageSize: 5,
      animalId: 3,
    });
  });

  it('rechaza valores no válidos y más de 100 por página', () => {
    expect(historyQuerySchema.safeParse({ animalId: '0' }).success).toBe(false);
    expect(historyQuerySchema.safeParse({ animalId: 'rufo' }).success).toBe(false);
    expect(historyQuerySchema.safeParse({ pageSize: '101' }).success).toBe(false);
  });
});
