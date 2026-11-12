import { describe, expect, it } from 'vitest';
import { feedQuerySchema, updateIdParamsSchema } from '../src/schemas/feed.schema.js';

describe('CU-17 feedQuerySchema', () => {
  it('por defecto muestra todas, primera página', () => {
    expect(feedQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20, unread: false });
  });

  it('convierte los filtros de la URL', () => {
    expect(feedQuerySchema.parse({ unread: 'true', animalId: '3', page: '2' })).toEqual({
      page: 2,
      pageSize: 20,
      unread: true,
      animalId: 3,
    });
  });

  it('rechaza valores no válidos', () => {
    expect(feedQuerySchema.safeParse({ unread: 'si' }).success).toBe(false);
    expect(feedQuerySchema.safeParse({ animalId: '0' }).success).toBe(false);
    expect(updateIdParamsSchema.safeParse({ updateId: 'abc' }).success).toBe(false);
    expect(updateIdParamsSchema.parse({ updateId: '7' })).toEqual({ updateId: 7 });
  });
});
