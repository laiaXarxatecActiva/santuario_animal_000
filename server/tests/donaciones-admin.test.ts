import { describe, expect, it } from 'vitest';
import { comprobarFechaDonacion, rangoMeses } from '../src/dominio/donaciones-admin.js';

describe('CU-39 Gestionar donaciones: reglas', () => {
  describe('comprobarFechaDonacion (A1)', () => {
    it('hoy y cualquier día anterior son válidos', () => {
      expect(comprobarFechaDonacion('2026-11-18', '2026-11-18')).toBeNull();
      expect(comprobarFechaDonacion('2026-11-02', '2026-11-18')).toBeNull();
      expect(comprobarFechaDonacion('2024-02-29', '2026-11-18')).toBeNull();
    });

    it('un día futuro no', () => {
      expect(comprobarFechaDonacion('2026-11-19', '2026-11-18')).toBe('DATE_IN_FUTURE');
    });

    it('un día que no existe en el calendario no', () => {
      expect(comprobarFechaDonacion('2026-02-30', '2026-11-18')).toBe('INVALID_DATE');
      expect(comprobarFechaDonacion('2025-02-29', '2026-11-18')).toBe('INVALID_DATE');
      expect(comprobarFechaDonacion('2026-13-01', '2026-11-18')).toBe('INVALID_DATE');
    });
  });

  describe('rangoMeses (paso 3, «Por meses»)', () => {
    it('sin fechas: los últimos 12 meses, con el actual', () => {
      expect(rangoMeses({}, '2026-11-18')).toEqual({ desde: '2025-12-01', hasta: '2026-11-01' });
    });

    it('con «desde» y «hasta»: los meses que abarcan', () => {
      expect(rangoMeses({ from: '2026-03-15', to: '2026-06-02' }, '2026-11-18')).toEqual({
        desde: '2026-03-01',
        hasta: '2026-06-01',
      });
    });

    it('solo «desde»: hasta el mes actual', () => {
      expect(rangoMeses({ from: '2026-03-15' }, '2026-11-18')).toEqual({ desde: '2026-03-01', hasta: '2026-11-01' });
    });

    it('solo «hasta»: los 12 meses que terminan en él', () => {
      expect(rangoMeses({ to: '2026-05-10' }, '2026-11-18')).toEqual({ desde: '2025-06-01', hasta: '2026-05-01' });
    });
  });
});
