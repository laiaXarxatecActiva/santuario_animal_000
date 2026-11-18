import { describe, expect, it } from 'vitest';
import { cambiaImporte, comprobarAltaPlan, comprobarEdicionPlan } from '../src/dominio/planes.js';

const usual = { isDefault: true, monthlyAmount: '5.00', activeAdoptions: 4 };
const simbolica = { isDefault: false, monthlyAmount: '1.00', activeAdoptions: 0 };
const cambios = (datos: Partial<Parameters<typeof comprobarEdicionPlan>[1]> = {}) => ({
  isDefault: false,
  isActive: true,
  monthlyAmount: '1.00',
  confirmAmountChange: false,
  ...datos,
});

describe('CU-40 Reglas de los planes', () => {
  it('cambiaImporte compara importes sin floats', () => {
    expect(cambiaImporte('5.00', '5.00')).toBe(false);
    expect(cambiaImporte('5.00', '5')).toBe(false);
    expect(cambiaImporte('5.00', '5.5')).toBe(true);
    expect(cambiaImporte('0.10', '0.1')).toBe(false);
    expect(cambiaImporte('12.00', '1.20')).toBe(true);
  });

  it('una edición correcta no tiene problemas', () => {
    expect(comprobarEdicionPlan(simbolica, cambios())).toBeNull();
    expect(comprobarEdicionPlan(simbolica, cambios({ isDefault: true }))).toBeNull();
    expect(comprobarEdicionPlan(simbolica, cambios({ isActive: false }))).toBeNull();
    expect(comprobarEdicionPlan(usual, cambios({ isDefault: true, monthlyAmount: '5.00' }))).toBeNull();
  });

  it('A1: no se puede desactivar el plan por defecto', () => {
    expect(comprobarEdicionPlan(usual, cambios({ isDefault: true, isActive: false, monthlyAmount: '5.00' }))).toBe(
      'DEFAULT_MUST_BE_ACTIVE',
    );
    expect(comprobarEdicionPlan(simbolica, cambios({ isDefault: true, isActive: false }))).toBe(
      'DEFAULT_MUST_BE_ACTIVE',
    );
  });

  it('A1: el plan por defecto no deja de serlo sin elegir antes otro', () => {
    expect(comprobarEdicionPlan(usual, cambios({ monthlyAmount: '5.00' }))).toBe('DEFAULT_NEEDS_REPLACEMENT');
    expect(comprobarEdicionPlan(usual, cambios({ isActive: false, monthlyAmount: '5.00' }))).toBe(
      'DEFAULT_NEEDS_REPLACEMENT',
    );
  });

  it('3a: cambiar el importe con adopciones activas exige confirmarlo', () => {
    const nuevoImporte = cambios({ isDefault: true, monthlyAmount: '6.00' });
    expect(comprobarEdicionPlan(usual, nuevoImporte)).toBe('AMOUNT_CHANGE_UNCONFIRMED');
    expect(comprobarEdicionPlan(usual, { ...nuevoImporte, confirmAmountChange: true })).toBeNull();
    // Sin adopciones activas no hace falta confirmar.
    expect(comprobarEdicionPlan(simbolica, cambios({ monthlyAmount: '2.00' }))).toBeNull();
  });

  it('A2: un plan nuevo por defecto tiene que estar activo', () => {
    expect(comprobarAltaPlan({ isDefault: false, isActive: false })).toBeNull();
    expect(comprobarAltaPlan({ isDefault: true, isActive: true })).toBeNull();
    expect(comprobarAltaPlan({ isDefault: true, isActive: false })).toBe('DEFAULT_MUST_BE_ACTIVE');
  });
});
