import { describe, expect, it } from 'vitest';
import {
  bajaAdopcion,
  bajaVencida,
  cambioDePlan,
  cuotaManualVencida,
  debeAvisarCuotaManual,
  debeCobrarse,
  esAdoptable,
  limiteCuotaManual,
  limitePagoPendiente,
  periodoCuota,
  puedeCambiarFormaDePago,
  puedeCambiarPlan,
  proximaActualizacionPrevista,
  puedePagar,
  sumarDias,
  sumarMeses,
  tieneRecibo,
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

describe('CU-43 debeCobrarse', () => {
  const activa = { status: 'active' as const, cancelRequested: false, nextBillingDate: '2026-11-17' };
  it('activa, sin baja y con la cuota vencida hoy o antes', () => {
    expect(debeCobrarse(activa, '2026-11-17')).toBe(true);
    expect(debeCobrarse({ ...activa, nextBillingDate: '2026-10-01' }, '2026-11-17')).toBe(true);
  });
  it('no se cobra antes de tiempo, con la baja pedida ni si no está activa', () => {
    expect(debeCobrarse({ ...activa, nextBillingDate: '2026-11-18' }, '2026-11-17')).toBe(false);
    expect(debeCobrarse({ ...activa, cancelRequested: true }, '2026-11-17')).toBe(false);
    expect(debeCobrarse({ ...activa, nextBillingDate: null }, '2026-11-17')).toBe(false);
    expect(debeCobrarse({ ...activa, status: 'paused' }, '2026-11-17')).toBe(false);
  });
});

describe('CU-44 limitePagoPendiente', () => {
  it('es el instante de hace 7 días: las pendientes anteriores ya no se pueden pagar (RN-07)', () => {
    const ahora = new Date('2026-11-17T03:30:00Z');
    const limite = limitePagoPendiente(ahora);
    expect(limite.toISOString()).toBe('2026-11-10T03:30:00.000Z');
    expect(puedePagar({ status: 'pending', createdAt: new Date(limite.getTime() - 1) }, ahora)).toBe(false);
    expect(puedePagar({ status: 'pending', createdAt: limite }, ahora)).toBe(true);
  });
});

describe('CU-45 bajaVencida', () => {
  const baja = { status: 'active' as const, cancelRequested: true, endDate: '2026-11-16' };
  it('termina el día siguiente al último pagado', () => {
    expect(bajaVencida(baja, '2026-11-17')).toBe(true);
    expect(bajaVencida(baja, '2026-11-16')).toBe(false);
  });
  it('sin baja pedida o sin estar activa no termina', () => {
    expect(bajaVencida({ ...baja, cancelRequested: false }, '2026-11-17')).toBe(false);
    expect(bajaVencida({ ...baja, status: 'paused' }, '2026-11-17')).toBe(false);
    expect(bajaVencida({ ...baja, endDate: null }, '2026-11-17')).toBe(false);
  });
});

describe('CU-20 Cambiar de plan', () => {
  it('1a: solo las activas sin baja solicitada', () => {
    expect(puedeCambiarPlan({ status: 'active', cancelRequested: false })).toBe(true);
    expect(puedeCambiarPlan({ status: 'active', cancelRequested: true })).toBe(false);
    expect(puedeCambiarPlan({ status: 'paused', cancelRequested: false })).toBe(false);
    expect(puedeCambiarPlan({ status: 'pending', cancelRequested: false })).toBe(false);
  });

  it('3: elegir otro plan lo programa para la próxima cuota', () => {
    expect(cambioDePlan({ planId: 2, nextPlanId: null }, 3)).toEqual({ tipo: 'programado', nextPlanId: 3 });
  });

  it('3b: con un cambio programado, otro plan lo sustituye', () => {
    expect(cambioDePlan({ planId: 2, nextPlanId: 3 }, 1)).toEqual({ tipo: 'programado', nextPlanId: 1 });
  });

  it('3a: elegir el plan actual anula el cambio programado, o no hace nada', () => {
    expect(cambioDePlan({ planId: 2, nextPlanId: 3 }, 2)).toEqual({ tipo: 'anulado', nextPlanId: null });
    expect(cambioDePlan({ planId: 2, nextPlanId: null }, 2)).toEqual({ tipo: 'ninguno', nextPlanId: null });
  });

  it('elegir el plan ya programado no cambia nada', () => {
    expect(cambioDePlan({ planId: 2, nextPlanId: 3 }, 3)).toEqual({ tipo: 'ninguno', nextPlanId: 3 });
  });
});

describe('CU-21 bajaAdopcion', () => {
  const hoy = '2026-11-17';
  it('4: activa: sigue activa hasta el último día pagado', () => {
    expect(bajaAdopcion({ status: 'active', cancelRequested: false, nextBillingDate: '2026-12-05' }, hoy)).toEqual({
      status: 'active',
      endReason: null,
      endDate: '2026-12-04',
    });
  });
  it('1a: pendiente: se cancela hoy, sin nada pagado', () => {
    expect(bajaAdopcion({ status: 'pending', cancelRequested: false, nextBillingDate: null }, hoy)).toEqual({
      status: 'cancelled',
      endReason: 'user_cancelled',
      endDate: hoy,
    });
  });
  it('1b: pausada: termina el último día pagado; la cuota pendiente no se cobra', () => {
    expect(bajaAdopcion({ status: 'paused', cancelRequested: false, nextBillingDate: '2026-11-10' }, hoy)).toEqual({
      status: 'finished',
      endReason: 'user_cancelled',
      endDate: '2026-11-09',
    });
  });
  it('con la baja ya pedida o cerrada no hay baja posible', () => {
    expect(bajaAdopcion({ status: 'active', cancelRequested: true, nextBillingDate: null }, hoy)).toBeNull();
    expect(bajaAdopcion({ status: 'finished', cancelRequested: false, nextBillingDate: null }, hoy)).toBeNull();
    expect(bajaAdopcion({ status: 'cancelled', cancelRequested: false, nextBillingDate: null }, hoy)).toBeNull();
  });
});

describe('CU-19 tieneRecibo', () => {
  it('4a, 4b: solo los pagos cobrados o devueltos tienen recibo', () => {
    expect(tieneRecibo('completed')).toBe(true);
    expect(tieneRecibo('refunded')).toBe(true);
    expect(tieneRecibo('failed')).toBe(false);
    expect(tieneRecibo('pending')).toBe(false);
  });
});

describe('CU-49 y CU-50 Cuotas con pago manual', () => {
  const ahora = new Date('2026-11-12T12:00:00Z');
  const manual = {
    status: 'active' as const,
    paymentMode: 'manual' as const,
    cancelRequested: false,
    nextBillingDate: '2026-11-20',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    reminderSentFor: null as string | null,
  };

  it('la tarea de cobro no cobra las manuales; las automáticas, como siempre (RN-08)', () => {
    expect(debeCobrarse({ ...manual, nextBillingDate: '2026-11-17' }, '2026-11-17')).toBe(false);
    expect(debeCobrarse({ ...manual, paymentMode: 'automatic', nextBillingDate: '2026-11-17' }, '2026-11-17')).toBe(
      true,
    );
  });

  it('se avisa una vez, desde 7 días antes de la cuota y hasta que se pausa', () => {
    expect(debeAvisarCuotaManual(manual, '2026-11-12')).toBe(false); // 8 días antes
    expect(debeAvisarCuotaManual(manual, '2026-11-13')).toBe(true); // 7 días antes
    expect(debeAvisarCuotaManual(manual, '2026-11-26')).toBe(true); // 6 días después
    expect(debeAvisarCuotaManual(manual, '2026-11-27')).toBe(false); // ya se pausa
    expect(debeAvisarCuotaManual({ ...manual, reminderSentFor: '2026-11-20' }, '2026-11-15')).toBe(false);
    expect(debeAvisarCuotaManual({ ...manual, reminderSentFor: '2026-10-20' }, '2026-11-15')).toBe(true);
  });

  it('no se avisa a las automáticas, con la baja pedida ni si no está activa', () => {
    expect(debeAvisarCuotaManual({ ...manual, paymentMode: 'automatic' }, '2026-11-15')).toBe(false);
    expect(debeAvisarCuotaManual({ ...manual, cancelRequested: true }, '2026-11-15')).toBe(false);
    expect(debeAvisarCuotaManual({ ...manual, status: 'paused' }, '2026-11-15')).toBe(false);
  });

  it('se puede pagar desde 7 días antes; el último día sin pausar es el sexto después de la cuota', () => {
    expect(puedePagar(manual, ahora, '2026-11-12')).toBe(false);
    expect(puedePagar(manual, ahora, '2026-11-13')).toBe(true);
    expect(puedePagar(manual, ahora, '2026-11-26')).toBe(true);
    expect(limiteCuotaManual('2026-11-20')).toBe('2026-11-26');
    expect(puedePagar({ ...manual, paymentMode: 'automatic' }, ahora, '2026-11-15')).toBe(false);
    expect(puedePagar({ ...manual, cancelRequested: true }, ahora, '2026-11-15')).toBe(false);
  });

  it('pasados los 7 días de margen sin pagar, la cuota manual está vencida (se pausa)', () => {
    expect(cuotaManualVencida(manual, '2026-11-26')).toBe(false);
    expect(cuotaManualVencida(manual, '2026-11-27')).toBe(true);
    expect(cuotaManualVencida({ ...manual, paymentMode: 'automatic' }, '2026-12-30')).toBe(false);
    expect(cuotaManualVencida({ ...manual, cancelRequested: true }, '2026-12-30')).toBe(false);
  });

  it('la forma de pago se cambia en una adopción pendiente, pausada o activa sin baja', () => {
    for (const status of ['pending', 'paused', 'active'] as const) {
      expect(puedeCambiarFormaDePago({ status, cancelRequested: false })).toBe(true);
    }
    expect(puedeCambiarFormaDePago({ status: 'active', cancelRequested: true })).toBe(false);
    for (const status of ['cancelled', 'finished'] as const) {
      expect(puedeCambiarFormaDePago({ status, cancelRequested: false })).toBe(false);
    }
  });
});
