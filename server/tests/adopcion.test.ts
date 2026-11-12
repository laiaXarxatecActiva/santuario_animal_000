import { describe, expect, it } from 'vitest';
import { esAdoptable, periodoCuota, puedePagar, sumarMeses } from '../src/dominio/adopcion.js';

describe('RN-06 esAdoptable', () => {
  it('solo los animales disponibles en el santuario o en tratamiento', () => {
    expect(esAdoptable({ status: 'in_sanctuary', isAdoptable: true })).toBe(true);
    expect(esAdoptable({ status: 'in_treatment', isAdoptable: true })).toBe(true);
    expect(esAdoptable({ status: 'in_sanctuary', isAdoptable: false })).toBe(false);
    expect(esAdoptable({ status: 'deceased', isAdoptable: true })).toBe(false);
    expect(esAdoptable({ status: 'transferred', isAdoptable: true })).toBe(false);
  });
});

describe('fechas de las cuotas', () => {
  it('sumarMeses se ajusta al último día del mes como PostgreSQL', () => {
    expect(sumarMeses('2026-11-12', 1)).toBe('2026-12-12');
    expect(sumarMeses('2026-12-15', 1)).toBe('2027-01-15');
    expect(sumarMeses('2027-01-31', 1)).toBe('2027-02-28');
    expect(sumarMeses('2028-01-31', 1)).toBe('2028-02-29');
    expect(sumarMeses('2026-03-31', -1)).toBe('2026-02-28');
  });

  it('una cuota cubre un mes: del día de inicio al día anterior al siguiente cobro', () => {
    expect(periodoCuota('2026-11-12')).toEqual({
      periodStart: '2026-11-12',
      periodEnd: '2026-12-11',
      nextBillingDate: '2026-12-12',
    });
    expect(periodoCuota('2027-01-31')).toEqual({
      periodStart: '2027-01-31',
      periodEnd: '2027-02-27',
      nextBillingDate: '2027-02-28',
    });
  });
});

describe('CU-14 puedePagar', () => {
  const ahora = new Date('2026-11-12T12:00:00Z');
  const haceDias = (dias: number) => new Date(ahora.getTime() - dias * 24 * 3600_000);

  it('una adopción pendiente se puede pagar durante 7 días (RN-07)', () => {
    expect(puedePagar({ status: 'pending', createdAt: haceDias(2) }, ahora)).toBe(true);
    expect(puedePagar({ status: 'pending', createdAt: haceDias(7) }, ahora)).toBe(true);
    expect(puedePagar({ status: 'pending', createdAt: haceDias(7.01) }, ahora)).toBe(false);
  });

  it('una pausada se puede regularizar; activas y cerradas no tienen nada que pagar', () => {
    expect(puedePagar({ status: 'paused', createdAt: haceDias(200) }, ahora)).toBe(true);
    for (const status of ['active', 'cancelled', 'finished'] as const) {
      expect(puedePagar({ status, createdAt: haceDias(1) }, ahora)).toBe(false);
    }
  });
});
