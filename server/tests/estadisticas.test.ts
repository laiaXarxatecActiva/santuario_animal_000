import { describe, expect, it } from 'vitest';
import { MAX_MESES_ESTADISTICAS, mesesDelRango, rangoEstadisticas } from '../src/dominio/estadisticas.js';

describe('CU-41 Rango de las estadísticas', () => {
  it('2: por defecto, los últimos 12 meses (incluido el actual)', () => {
    expect(rangoEstadisticas({}, '2026-11-18')).toEqual({ desde: '2025-12-01', hasta: '2026-11-01' });
  });

  it('2: con «desde» y «hasta», los meses que abarcan', () => {
    expect(rangoEstadisticas({ from: '2026-01-15', to: '2026-03-02' }, '2026-11-18')).toEqual({
      desde: '2026-01-01',
      hasta: '2026-03-01',
    });
    // Solo «desde»: hasta el mes actual.
    expect(rangoEstadisticas({ from: '2026-06-30' }, '2026-11-18')).toEqual({
      desde: '2026-06-01',
      hasta: '2026-11-01',
    });
  });

  it('cuenta los meses del rango, ambos incluidos', () => {
    expect(mesesDelRango({ desde: '2025-12-01', hasta: '2026-11-01' })).toBe(12);
    expect(mesesDelRango({ desde: '2026-03-01', hasta: '2026-03-01' })).toBe(1);
  });

  it(`como mucho ${MAX_MESES_ESTADISTICAS} meses`, () => {
    expect(MAX_MESES_ESTADISTICAS).toBe(60);
  });
});
