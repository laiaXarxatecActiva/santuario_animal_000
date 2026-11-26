import type { AdoptionAdminAction, AdoptionStatus, ManualPaymentMethod } from '@sanctuary/shared';

// CU-37 Gestionar adopciones: reglas del administrador. Sin dependencias externas.

export type ProblemaAdopcionAdmin = 'ADOPTION_ACTION_NOT_ALLOWED';

/**
 * A1: se pausa una activa (si el adoptante ya pidió la baja, no se le cobra
 * más y pausarla no tiene sentido). A2: se reanuda una pausada. A3: se cancela
 * cualquier abierta.
 */
export function comprobarAccion(
  adopcion: { status: AdoptionStatus; cancelRequested: boolean },
  accion: AdoptionAdminAction,
): ProblemaAdopcionAdmin | null {
  const permitida = {
    pause: adopcion.status === 'active' && !adopcion.cancelRequested,
    resume: adopcion.status === 'paused',
    cancel: adopcion.status === 'pending' || adopcion.status === 'active' || adopcion.status === 'paused',
  }[accion];
  return permitida ? null : 'ADOPTION_ACTION_NOT_ALLOWED';
}

/** A3: termina hoy (nunca antes del inicio) con `admin_cancelled`. */
export function cierreAdmin(
  adopcion: { startDate: string | null },
  hoy: string,
): { status: 'cancelled'; endReason: 'admin_cancelled'; endDate: string } {
  const endDate = adopcion.startDate !== null && adopcion.startDate > hoy ? adopcion.startDate : hoy;
  return { status: 'cancelled', endReason: 'admin_cancelled', endDate };
}

/**
 * Notas internas: cada entrada se añade al final como una línea
 * «18/11/2026 · Pausa · Marta Soler: motivo», sin borrar las anteriores.
 */
export function anotar(
  previas: string | null,
  entrada: { fecha: string; accion: string; autor: string; texto: string },
): string {
  const [anio, mes, dia] = entrada.fecha.split('-');
  const linea = `${dia}/${mes}/${anio} · ${entrada.accion} · ${entrada.autor}: ${entrada.texto.trim()}`;
  return previas ? `${previas}\n${linea}` : linea;
}

/**
 * Prefijo de la referencia de un pago manual (como en TEST_DATA.sql). Hoy solo
 * hay transferencia; si se añade otra forma de pago, tendrá su prefijo.
 */
export function prefijoReferenciaManual(metodo: ManualPaymentMethod): 'TRF' {
  switch (metodo) {
    case 'bank_transfer':
      return 'TRF';
  }
}
