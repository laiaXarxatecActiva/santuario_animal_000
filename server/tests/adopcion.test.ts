import { describe, expect, it } from 'vitest';
import {
  esAdoptable,
  periodoCuota,
  proximaActualizacionPrevista,
  puedePagar,
  sumarDias,
  sumarMeses,
  veContenidoExclusivo,
} from '../src/dominio/adopcion.js';

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

describe('sumarDias', () => {
  it('suma y resta días cruzando meses y años', () => {
    expect(sumarDias('2026-11-12', 14)).toBe('2026-11-26');
    expect(sumarDias('2026-12-25', 14)).toBe('2027-01-08');
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('CU-15 proximaActualizacionPrevista (RN-14)', () => {
  it('es la última actualización del animal + 14 días', () => {
    expect(proximaActualizacionPrevista({ status: 'active', startDate: '2026-01-01' }, '2026-11-10')).toBe(
      '2026-11-24',
    );
  });

  it('si el animal no tiene actualizaciones, cuenta desde el inicio de la adopción', () => {
    expect(proximaActualizacionPrevista({ status: 'active', startDate: '2026-11-01' }, null)).toBe('2026-11-15');
  });

  it('solo tiene sentido en las adopciones activas', () => {
    for (const status of ['pending', 'paused', 'cancelled', 'finished'] as const) {
      expect(proximaActualizacionPrevista({ status, startDate: '2026-11-01' }, '2026-11-10')).toBeNull();
    }
  });
});

describe('RN-15 veContenidoExclusivo', () => {
  it('solo una adopción activa da acceso al contenido exclusivo (TECH_SPEC §18.2)', () => {
    expect(veContenidoExclusivo('active')).toBe(true);
    for (const status of ['pending', 'paused', 'cancelled', 'finished'] as const) {
      expect(veContenidoExclusivo(status)).toBe(false);
    }
  });
});
