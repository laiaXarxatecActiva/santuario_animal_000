import { describe, expect, it } from 'vitest';
import { edadEnAnios, limitesDeNacimiento, restarAnios } from '../src/dominio/edad.js';

describe('edadEnAnios', () => {
  it('cuenta los años cumplidos', () => {
    expect(edadEnAnios('2014-11-12', '2026-11-12')).toBe(12);
    expect(edadEnAnios('2014-11-13', '2026-11-12')).toBe(11);
    expect(edadEnAnios('2014-12-01', '2026-11-12')).toBe(11);
  });

  it('el día de llegada de un recién nacido tiene 0 años', () => {
    expect(edadEnAnios('2026-11-12', '2026-11-12')).toBe(0);
  });

  it('quien nació un 29 de febrero cumple el 1 de marzo en años no bisiestos', () => {
    expect(edadEnAnios('2020-02-29', '2025-02-28')).toBe(4);
    expect(edadEnAnios('2020-02-29', '2025-03-01')).toBe(5);
  });
});

describe('restarAnios', () => {
  it('resta años a una fecha', () => {
    expect(restarAnios('2026-11-12', 5)).toBe('2021-11-12');
  });

  it('el 29 de febrero pasa a 28 si el año resultante no es bisiesto', () => {
    expect(restarAnios('2028-02-29', 1)).toBe('2027-02-28');
  });
});

describe('limitesDeNacimiento', () => {
  const hoy = '2026-11-12';

  it('sin edades no hay límites', () => {
    expect(limitesDeNacimiento({}, hoy)).toEqual({});
  });

  it('edad mínima: nacido como tarde ese día', () => {
    expect(limitesDeNacimiento({ minAge: 5 }, hoy)).toEqual({ nacidoComoTarde: '2021-11-12' });
  });

  it('edad máxima: nacido después de hoy menos (máxima + 1) años', () => {
    expect(limitesDeNacimiento({ maxAge: 4 }, hoy)).toEqual({ nacidoDespuesDe: '2021-11-12' });
  });

  it('los límites coinciden con edadEnAnios', () => {
    const { nacidoComoTarde, nacidoDespuesDe } = limitesDeNacimiento({ minAge: 5, maxAge: 15 }, hoy);
    expect(edadEnAnios(nacidoComoTarde ?? '', hoy)).toBe(5);
    expect(edadEnAnios(nacidoDespuesDe ?? '', hoy)).toBe(16);
  });
});
