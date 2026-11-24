// CU-71: reglas de las notas de relevo. Sin dependencias externas.
import { HANDOVER_HOURS, type Role } from '@sanctuary/shared';

/** Se escribe en una zona del turno de hoy; el administrador, en cualquiera. */
export function puedeEscribirRelevo(rol: Role, zonasDeMiTurno: readonly number[], zoneId: number): boolean {
  return rol === 'admin' || zonasDeMiTurno.includes(zoneId);
}

/** Zonas cuyas notas se ven: las del turno de hoy; el administrador, todas. */
export function zonasDelRelevo(rol: Role, zonasDeMiTurno: readonly number[], todas: readonly number[]): number[] {
  if (rol === 'admin') return [...todas];
  return [...new Set(zonasDeMiTurno)].sort((a, b) => a - b);
}

/** Las notas se ven durante 24 horas. */
export function desdeDelRelevo(ahora: Date): Date {
  return new Date(ahora.getTime() - HANDOVER_HOURS * 60 * 60 * 1000);
}
