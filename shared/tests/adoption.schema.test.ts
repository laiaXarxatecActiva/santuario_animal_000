import { describe, expect, it } from 'vitest';
import { PAYMENT_MODES } from '../src/constants/status.js';
import {
  changePaymentModeSchema,
  createAdoptionSchema,
  myAdoptionsQuerySchema,
  payAdoptionSchema,
} from '../src/schemas/adoption.schema.js';

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

describe('CU-49 Forma de pago', () => {
  it('al adoptar, la forma de pago es opcional (sin ella, el servidor usa la automática)', () => {
    expect(createAdoptionSchema.parse({ animalId: 1, planId: 2 }).paymentMode).toBeUndefined();
    expect(createAdoptionSchema.parse({ animalId: 1, planId: 2, paymentMode: 'manual' }).paymentMode).toBe('manual');
    expect(createAdoptionSchema.safeParse({ animalId: 1, planId: 2, paymentMode: 'mensual' }).success).toBe(false);
  });

  it('el cambio exige una de las dos formas', () => {
    expect(changePaymentModeSchema.parse({ paymentMode: 'manual' })).toEqual({ paymentMode: 'manual' });
    expect(changePaymentModeSchema.safeParse({}).success).toBe(false);
    expect(changePaymentModeSchema.safeParse({ paymentMode: 'otra' }).success).toBe(false);
  });

  it('PAYMENT_MODES replica el CHECK de adoptions.payment_mode', () => {
    expect(PAYMENT_MODES).toEqual(['automatic', 'manual']);
  });
});
