import { describe, expect, it } from 'vitest';
import { AGE_RANGES, ANIMAL_SEXES, PUBLIC_ANIMAL_STATUSES } from '../src/constants/animals.js';

describe('constantes de animales', () => {
  it('los sexos coinciden con el CHECK de animals.sex', () => {
    expect(ANIMAL_SEXES).toEqual(['male', 'female', 'unknown']);
  });

  it('solo los animales en el santuario o en tratamiento son públicos (RN-22)', () => {
    expect(PUBLIC_ANIMAL_STATUSES).toEqual(['in_sanctuary', 'in_treatment']);
  });

  it('los rangos de edad del catálogo no se solapan y cubren todas las edades', () => {
    expect(AGE_RANGES).toEqual({
      young: { minAge: 0, maxAge: 4 },
      adult: { minAge: 5, maxAge: 15 },
      senior: { minAge: 16 },
    });
  });
});
