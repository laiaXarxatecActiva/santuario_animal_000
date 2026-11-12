import { PUBLIC_ANIMAL_STATUSES, type AdoptionStatus, type AnimalStatus } from '@sanctuary/shared';

// Reglas de las adopciones (RN-06, RN-07) y de las fechas de sus cuotas.

export const DIAS_PARA_COMPLETAR_PAGO = 7;
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

function restarDia(fecha: string): string {
  const [y = 0, m = 1, d = 1] = fecha.split('-').map(Number);
  return aFecha(y, m - 1, d - 1);
}

/** Mes que cubre una cuota que empieza en `inicio` y fecha del siguiente cobro. */
export function periodoCuota(inicio: string): { periodStart: string; periodEnd: string; nextBillingDate: string } {
  const nextBillingDate = sumarMeses(inicio, 1);
  return { periodStart: inicio, periodEnd: restarDia(nextBillingDate), nextBillingDate };
}
