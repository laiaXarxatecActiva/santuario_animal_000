import { PUBLIC_ANIMAL_STATUSES, type AdoptionStatus, type AnimalStatus, type PaymentStatus } from '@sanctuary/shared';

// Reglas de las adopciones (RN-06, RN-07) y de las fechas de sus cuotas.

export const DIAS_PARA_COMPLETAR_PAGO = 7;
/** RN-14: compromiso de una actualización cada 14 días. */
export const DIAS_ENTRE_ACTUALIZACIONES = 14;
const DIA_MS = 24 * 60 * 60 * 1000;

/** RN-06: disponible para adoptar y en el santuario o en tratamiento (la publicación la filtra la consulta). */
export function esAdoptable(animal: { status: AnimalStatus; isAdoptable: boolean }): boolean {
  return animal.isAdoptable && (PUBLIC_ANIMAL_STATUSES as readonly AnimalStatus[]).includes(animal.status);
}

/** CU-14: se puede pagar una pendiente creada hace 7 días o menos (RN-07) o una pausada (RN-08). */
export function puedePagar(adopcion: { status: AdoptionStatus; createdAt: Date }, ahora: Date): boolean {
  if (adopcion.status === 'paused') return true;
  if (adopcion.status !== 'pending') return false;
  return ahora.getTime() - adopcion.createdAt.getTime() <= DIAS_PARA_COMPLETAR_PAGO * DIA_MS;
}

const aFecha = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);

/** Suma meses a una fecha `YYYY-MM-DD`; si el día no existe, usa el último del mes (como PostgreSQL). */
export function sumarMeses(fecha: string, meses: number): string {
  const [y = 0, m = 1, d = 1] = fecha.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(y, m - 1 + meses + 1, 0)).getUTCDate();
  return aFecha(y, m - 1 + meses, Math.min(d, ultimoDia));
}

/** Suma (o resta) días a una fecha `YYYY-MM-DD`. */
export function sumarDias(fecha: string, dias: number): string {
  const [y = 0, m = 1, d = 1] = fecha.split('-').map(Number);
  return aFecha(y, m - 1, d + dias);
}

const restarDia = (fecha: string) => sumarDias(fecha, -1);

/** Mes que cubre una cuota que empieza en `inicio` y fecha del siguiente cobro. */
export function periodoCuota(inicio: string): { periodStart: string; periodEnd: string; nextBillingDate: string } {
  const nextBillingDate = sumarMeses(inicio, 1);
  return { periodStart: inicio, periodEnd: restarDia(nextBillingDate), nextBillingDate };
}

/** RN-15 y TECH_SPEC §18.2: solo una adopción activa da acceso al contenido exclusivo. */
export function veContenidoExclusivo(status: AdoptionStatus): boolean {
  return status === 'active';
}

/**
 * CU-15: fecha prevista de la próxima actualización (RN-14): la última del
 * animal + 14 días o, si no hay ninguna, el inicio de la adopción + 14 días.
 * Solo se muestra en las adopciones activas.
 */
export function proximaActualizacionPrevista(
  adopcion: { status: AdoptionStatus; startDate: string | null },
  ultimaActualizacion: string | null,
): string | null {
  if (!veContenidoExclusivo(adopcion.status)) return null;
  const desde = ultimaActualizacion ?? adopcion.startDate;
  return desde === null ? null : sumarDias(desde, DIAS_ENTRE_ACTUALIZACIONES);
}

/** CU-43: activa, sin baja solicitada y con la cuota vencida hoy o antes (RN-08). */
export function debeCobrarse(
  adopcion: { status: AdoptionStatus; cancelRequested: boolean; nextBillingDate: string | null },
  hoy: string,
): boolean {
  return (
    adopcion.status === 'active' &&
    !adopcion.cancelRequested &&
    adopcion.nextBillingDate !== null &&
    adopcion.nextBillingDate <= hoy
  );
}

/** CU-44 (RN-07): las pendientes creadas antes de este instante ya no se pueden pagar. */
export function limitePagoPendiente(ahora: Date): Date {
  return new Date(ahora.getTime() - DIAS_PARA_COMPLETAR_PAGO * DIA_MS);
}

/** CU-45 (RN-10): la baja termina el día siguiente al último pagado (`end_date`). */
export function bajaVencida(
  adopcion: { status: AdoptionStatus; cancelRequested: boolean; endDate: string | null },
  hoy: string,
): boolean {
  return (
    adopcion.status === 'active' && adopcion.cancelRequested && adopcion.endDate !== null && adopcion.endDate < hoy
  );
}

/** CU-20 1a: solo se cambia el plan de una adopción activa sin baja solicitada. */
export function puedeCambiarPlan(adopcion: { status: AdoptionStatus; cancelRequested: boolean }): boolean {
  return adopcion.status === 'active' && !adopcion.cancelRequested;
}

export type CambioDePlan =
  | { tipo: 'programado'; nextPlanId: number }
  | { tipo: 'anulado'; nextPlanId: null }
  | { tipo: 'ninguno'; nextPlanId: number | null };

/** CU-20 pasos 3-4: qué pasa con `next_plan_id` al elegir un plan (3a, 3b). */
export function cambioDePlan(actual: { planId: number; nextPlanId: number | null }, elegido: number): CambioDePlan {
  if (elegido === actual.planId) {
    return actual.nextPlanId === null ? { tipo: 'ninguno', nextPlanId: null } : { tipo: 'anulado', nextPlanId: null };
  }
  if (elegido === actual.nextPlanId) return { tipo: 'ninguno', nextPlanId: elegido };
  return { tipo: 'programado', nextPlanId: elegido };
}

/**
 * CU-21 (RN-10): cómo queda la adopción tras la baja. La activa sigue activa
 * hasta el último día pagado; la pendiente se cancela (1a) y la pausada termina
 * el último día pagado (1b). `null` si ya no admite baja. CU-35 4a usa la misma
 * baja al desactivar a un adoptante, con el motivo `admin_cancelled`.
 */
export function bajaAdopcion(
  adopcion: { status: AdoptionStatus; cancelRequested: boolean; nextBillingDate: string | null },
  hoy: string,
  motivo: 'user_cancelled' | 'admin_cancelled' = 'user_cancelled',
): { status: AdoptionStatus; endReason: 'user_cancelled' | 'admin_cancelled' | null; endDate: string } | null {
  const ultimoPagado = adopcion.nextBillingDate === null ? null : sumarDias(adopcion.nextBillingDate, -1);
  if (adopcion.status === 'pending') return { status: 'cancelled', endReason: motivo, endDate: hoy };
  if (ultimoPagado === null || adopcion.cancelRequested) return null;
  if (adopcion.status === 'active') return { status: 'active', endReason: null, endDate: ultimoPagado };
  if (adopcion.status === 'paused') return { status: 'finished', endReason: motivo, endDate: ultimoPagado };
  return null;
}

/** CU-19 4a, 4b: solo los pagos cobrados o devueltos tienen recibo. */
export function tieneRecibo(status: PaymentStatus): status is 'completed' | 'refunded' {
  return status === 'completed' || status === 'refunded';
}
