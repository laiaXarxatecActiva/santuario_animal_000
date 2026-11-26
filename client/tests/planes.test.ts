import { describe, expect, it } from 'vitest';
import { cambiarInterruptor, type BorradorPlan } from '../src/utils/planes';

const plan = (id: number, isDefault: boolean, isActive: boolean): BorradorPlan => ({
  id,
  name: `Plan ${id}`,
  monthlyAmount: '1,00',
  description: '',
  isDefault,
  isActive,
});
const planes = [plan(1, false, true), plan(2, true, true), plan(3, false, false)];
const marcas = (lista: readonly BorradorPlan[]) => lista.map((p) => [p.isDefault, p.isActive]);

describe('CU-40 Interruptores de los planes al editar', () => {
  it('marcar otro plan por defecto desmarca el anterior', () => {
    const { planes: nuevos, aviso } = cambiarInterruptor(planes, 0, 'isDefault', true);
    expect(marcas(nuevos)).toEqual([
      [true, true],
      [false, true],
      [false, false],
    ]);
    expect(aviso).toBeNull();
  });

  it('un plan desactivado marcado por defecto se activa, con un aviso', () => {
    const { planes: nuevos, aviso } = cambiarInterruptor(planes, 2, 'isDefault', true);
    expect(marcas(nuevos)).toEqual([
      [false, true],
      [false, true],
      [true, true],
    ]);
    expect(aviso).toBe('activatedAsDefault');
  });

  it('el plan por defecto no se desmarca ni se desactiva: no cambia nada y avisa', () => {
    expect(cambiarInterruptor(planes, 1, 'isDefault', false)).toEqual({ planes, aviso: 'defaultRequired' });
    expect(cambiarInterruptor(planes, 1, 'isActive', false)).toEqual({ planes, aviso: 'defaultMustBeActive' });
  });

  it('los demás planes se activan y desactivan sin más', () => {
    const { planes: nuevos, aviso } = cambiarInterruptor(planes, 0, 'isActive', false);
    expect(nuevos[0]?.isActive).toBe(false);
    expect(aviso).toBeNull();
    expect(planes[0]?.isActive).toBe(true);
  });
});
