import { describe, expect, it } from 'vitest';
import {
  cambiaImporte,
  comprobarAltaPlan,
  comprobarBorradoPlan,
  comprobarEdicionPlan,
  comprobarPlanes,
} from '../src/dominio/planes.js';

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

describe('CU-40 Guardar todos los planes a la vez: reglas', () => {
  const guardados = [
    { id: 1, isDefault: false, isActive: true, monthlyAmount: '1.00', activeAdoptions: 0 },
    { id: 2, isDefault: true, isActive: true, monthlyAmount: '5.00', activeAdoptions: 4 },
    { id: 3, isDefault: false, isActive: false, monthlyAmount: '12.00', activeAdoptions: 1 },
  ];
  const sin = ({ activeAdoptions: _a, ...resto }: (typeof guardados)[number]) => resto;
  const todos = (cambios: Record<number, Partial<ReturnType<typeof sin>>> = {}) =>
    guardados.map((p) => ({ ...sin(p), ...cambios[p.id] }));

  it('sin cambios, o cambiando el plan por defecto a otro activo, no hay problemas', () => {
    expect(comprobarPlanes(guardados, todos(), false)).toBeNull();
    expect(comprobarPlanes(guardados, todos({ 1: { isDefault: true }, 2: { isDefault: false } }), false)).toBeNull();
    // Solo se envía una parte: los demás siguen como están.
    expect(comprobarPlanes(guardados, [{ ...sin(guardados[0]!), monthlyAmount: '2.00' }], false)).toBeNull();
  });

  it('siempre tiene que haber un plan por defecto', () => {
    expect(comprobarPlanes(guardados, todos({ 2: { isDefault: false } }), false)).toEqual({
      problema: 'DEFAULT_NEEDS_REPLACEMENT',
      planId: 2,
    });
  });

  it('solo puede haber un plan por defecto', () => {
    expect(comprobarPlanes(guardados, todos({ 1: { isDefault: true } }), false)).toEqual({
      problema: 'DEFAULT_NOT_UNIQUE',
      planId: 1,
    });
  });

  it('el plan por defecto tiene que estar activo', () => {
    expect(comprobarPlanes(guardados, todos({ 2: { isActive: false } }), false)).toEqual({
      problema: 'DEFAULT_MUST_BE_ACTIVE',
      planId: 2,
    });
    expect(comprobarPlanes(guardados, todos({ 2: { isDefault: false }, 3: { isDefault: true } }), false)).toEqual({
      problema: 'DEFAULT_MUST_BE_ACTIVE',
      planId: 3,
    });
  });

  it('3a: un nuevo importe con adopciones activas se confirma una vez para todos', () => {
    const cambios = todos({ 2: { monthlyAmount: '6' }, 3: { monthlyAmount: '12' } });
    expect(comprobarPlanes(guardados, cambios, false)).toEqual({
      problema: 'AMOUNT_CHANGE_UNCONFIRMED',
      planId: 2,
      activeAdoptions: 4,
    });
    expect(comprobarPlanes(guardados, cambios, true)).toBeNull();
    // Sin adopciones activas no hace falta.
    expect(comprobarPlanes(guardados, todos({ 1: { monthlyAmount: '3' } }), false)).toBeNull();
  });
});

describe('CU-40 A3 Borrar un plan: reglas', () => {
  it('solo se borra un plan que nunca se ha usado y que no es el de por defecto', () => {
    expect(comprobarBorradoPlan({ isDefault: false, enUso: false })).toBeNull();
    expect(comprobarBorradoPlan({ isDefault: false, enUso: true })).toBe('HAS_HISTORY');
    expect(comprobarBorradoPlan({ isDefault: true, enUso: false })).toBe('DEFAULT_CANNOT_BE_DELETED');
    expect(comprobarBorradoPlan({ isDefault: true, enUso: true })).toBe('DEFAULT_CANNOT_BE_DELETED');
  });
});
