import { describe, expect, it } from 'vitest';
import { cuotaPendiente, pasaPorPasarela, puedeDevolverse } from '../src/dominio/pagos-admin.js';

const ahora = new Date('2026-11-18T12:00:00Z');
const hoy = '2026-11-18';
const plan = { id: 2, name: 'Usual', monthlyAmount: '5.00' };
const base = {
  status: 'active' as const,
  cancelRequested: false,
  nextBillingDate: '2026-12-05',
  createdAt: new Date('2026-01-01T10:00:00Z'),
  plan,
  nextPlan: null,
};

describe('CU-38 Gestionar pagos: reglas', () => {
  it('A1: solo se devuelve un pago cobrado (A1a)', () => {
    expect(puedeDevolverse('completed')).toBe(true);
    for (const status of ['pending', 'failed', 'refunded'] as const) expect(puedeDevolverse(status)).toBe(false);
  });

  it('A1: la pasarela solo interviene en los pagos hechos en la web (tarjeta)', () => {
    expect(pasaPorPasarela('card')).toBe(true);
    expect(pasaPorPasarela('bank_transfer')).toBe(false);
  });

  describe('cuotaPendiente (A2)', () => {
    it('activa: la cuota que empieza en el próximo cobro, con el importe del plan', () => {
      expect(cuotaPendiente(base, ahora, hoy)).toEqual({
        periodStart: '2026-12-05',
        periodEnd: '2027-01-04',
        nextBillingDate: '2027-01-05',
        plan,
      });
    });

    it('pausada: la cuota que quedó sin cobrar', () => {
      expect(cuotaPendiente({ ...base, status: 'paused', nextBillingDate: '2026-11-01' }, ahora, hoy)).toMatchObject({
        periodStart: '2026-11-01',
        nextBillingDate: '2026-12-01',
      });
    });

    it('con un cambio de plan programado, la cuota es del plan nuevo', () => {
      const nuevo = { id: 3, name: 'Extraordinaria', monthlyAmount: '12.00' };
      expect(cuotaPendiente({ ...base, nextPlan: nuevo }, ahora, hoy)?.plan).toEqual(nuevo);
    });

    it('pendiente de pago (dentro de los 7 días): el primer mes empieza hoy', () => {
      const pendiente = {
        ...base,
        status: 'pending' as const,
        nextBillingDate: null,
        createdAt: new Date('2026-11-16T10:00:00Z'),
      };
      expect(cuotaPendiente(pendiente, ahora, hoy)).toMatchObject({ periodStart: hoy, nextBillingDate: '2026-12-18' });
    });

    it('sin cuota que pagar: pendiente caducada, baja solicitada o cerrada', () => {
      const caducada = {
        ...base,
        status: 'pending' as const,
        nextBillingDate: null,
        createdAt: new Date('2026-11-01T10:00:00Z'),
      };
      expect(cuotaPendiente(caducada, ahora, hoy)).toBeNull();
      expect(cuotaPendiente({ ...base, cancelRequested: true, nextBillingDate: null }, ahora, hoy)).toBeNull();
      for (const status of ['cancelled', 'finished'] as const) {
        expect(cuotaPendiente({ ...base, status }, ahora, hoy)).toBeNull();
      }
    });
  });
});
