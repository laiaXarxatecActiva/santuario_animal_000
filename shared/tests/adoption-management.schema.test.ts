import { describe, expect, it } from 'vitest';
import { changePlanSchema } from '../src/schemas/adoption.schema.js';
import { contributionsQuerySchema } from '../src/schemas/contribution.schema.js';

describe('CU-20 changePlanSchema', () => {
  it('exige un planId entero positivo', () => {
    expect(changePlanSchema.parse({ planId: 3 })).toEqual({ planId: 3 });
    expect(changePlanSchema.safeParse({ planId: '3' }).success).toBe(false);
    expect(changePlanSchema.safeParse({ planId: 0 }).success).toBe(false);
    expect(changePlanSchema.safeParse({}).success).toBe(false);
  });
});

describe('CU-19 contributionsQuerySchema', () => {
  it('el año es opcional y numérico', () => {
    expect(contributionsQuerySchema.parse({})).toEqual({});
    expect(contributionsQuerySchema.parse({ year: '2026' })).toEqual({ year: 2026 });
    expect(contributionsQuerySchema.safeParse({ year: 'este' }).success).toBe(false);
    expect(contributionsQuerySchema.safeParse({ year: '1999' }).success).toBe(false);
  });
});
