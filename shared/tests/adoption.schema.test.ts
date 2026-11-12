import { describe, expect, it } from 'vitest';
import { createAdoptionSchema, myAdoptionsQuerySchema, payAdoptionSchema } from '../src/schemas/adoption.schema.js';

describe('CU-13 createAdoptionSchema', () => {
  it('exige el animal y el plan como enteros positivos', () => {
    expect(createAdoptionSchema.parse({ animalId: 3, planId: 2 })).toEqual({ animalId: 3, planId: 2 });
    expect(createAdoptionSchema.safeParse({ animalId: '3', planId: 2 }).success).toBe(false);
    expect(createAdoptionSchema.safeParse({ animalId: 0, planId: 2 }).success).toBe(false);
    expect(createAdoptionSchema.safeParse({ animalId: 3 }).success).toBe(false);
  });

  it('descarta cualquier otro campo (el usuario sale de la sesión)', () => {
    expect(createAdoptionSchema.parse({ animalId: 3, planId: 2, userId: 1 })).toEqual({ animalId: 3, planId: 2 });
  });
});

describe('CU-14 payAdoptionSchema', () => {
  it('el resultado simulado es opcional y solo admite success o failure', () => {
    expect(payAdoptionSchema.parse({})).toEqual({});
    expect(payAdoptionSchema.parse({ simulatedOutcome: 'failure' })).toEqual({ simulatedOutcome: 'failure' });
    expect(payAdoptionSchema.safeParse({ simulatedOutcome: 'maybe' }).success).toBe(false);
  });

  it('nunca acepta datos de tarjeta (RN-13): se descartan', () => {
    expect(payAdoptionSchema.parse({ cardNumber: '4111111111111111' })).toEqual({});
  });
});

describe('myAdoptionsQuerySchema', () => {
  it('filtra opcionalmente por animal', () => {
    expect(myAdoptionsQuerySchema.parse({})).toEqual({});
    expect(myAdoptionsQuerySchema.parse({ animalId: '5' })).toEqual({ animalId: 5 });
    expect(myAdoptionsQuerySchema.safeParse({ animalId: 'x' }).success).toBe(false);
  });
});
