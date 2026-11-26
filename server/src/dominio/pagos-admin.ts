import type { AdoptionStatus, PaymentMethod, PaymentStatus } from '@sanctuary/shared';
import { periodoCuota, puedePagar } from './adopcion.js';

// CU-38 Gestionar pagos: reglas del administrador. Sin dependencias externas.

/** A1 y A1a: solo se devuelve un pago cobrado. */
export function puedeDevolverse(status: PaymentStatus): boolean {
  return status === 'completed';
}

/**
 * A1: los pagos con tarjeta (hechos en la web) se devuelven a través de la
 * pasarela; las transferencias se devuelven a mano y solo se marcan como devueltas.
 */
export function pasaPorPasarela(metodo: PaymentMethod): boolean {
  return metodo === 'card';
}

interface PlanCuota {
  id: number;
  name: string;
  monthlyAmount: string;
}

export interface CuotaPendiente {
  periodStart: string;
  periodEnd: string;
  /** Próximo cobro una vez pagada esta cuota. */
  nextBillingDate: string;
  /** Plan con el que se cobra: el programado (CU-20), si lo hay, como en CU-43. */
  plan: PlanCuota;
}

/**
 * A2: la única cuota que se puede registrar a mano.
 * - Activa o pausada (sin baja solicitada): la que empieza en el próximo cobro.
 * - Pendiente dentro de los 7 días (RN-07): el primer mes, que empieza hoy.
 * - En cualquier otro caso, ninguna.
 */
export function cuotaPendiente(
  adopcion: {
    status: AdoptionStatus;
    cancelRequested: boolean;
    nextBillingDate: string | null;
    createdAt: Date;
    plan: PlanCuota;
    nextPlan: PlanCuota | null;
  },
  ahora: Date,
  hoy: string,
): CuotaPendiente | null {
  const plan = adopcion.nextPlan ?? adopcion.plan;
  if (adopcion.status === 'pending') {
    return puedePagar(adopcion, ahora) ? { ...periodoCuota(hoy), plan } : null;
  }
  const abierta = adopcion.status === 'active' || adopcion.status === 'paused';
  if (!abierta || adopcion.cancelRequested || adopcion.nextBillingDate === null) return null;
  return { ...periodoCuota(adopcion.nextBillingDate), plan };
}
