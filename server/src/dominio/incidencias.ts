// CU-70: reglas de las incidencias. Sin dependencias externas.
import type { IncidentSeverity, IncidentStatus } from '@sanctuary/shared';
import { destinatariosDelAviso } from './cuidados.js';

/** Solo las de gravedad alta se avisan al momento; las demás salen en la lista y en «Hoy». */
export function avisarAlMomento(gravedad: IncidentSeverity): boolean {
  return gravedad === 'high';
}

/** Los administradores y quien tiene turno en la zona, sin repetir y sin quien la comunica. */
export function destinatariosDeLaIncidencia(
  admins: readonly number[],
  deTurno: readonly number[],
  autorId: number,
): number[] {
  return destinatariosDelAviso(admins, deTurno).filter((id) => id !== autorId);
}

/** Se puede pasar a cualquier otro estado (también reabrirla), pero no al mismo. */
export function comprobarCambioDeEstado(actual: IncidentStatus, nuevo: IncidentStatus): 'SAME_STATUS' | null {
  return actual === nuevo ? 'SAME_STATUS' : null;
}

export interface Resolucion {
  resolution: string | null;
  resolvedBy: number | null;
  resolvedAt: Date | null;
}

/** Al resolverla se guarda cómo, quién y cuándo; en otro estado, nada. */
export function datosDeResolucion(nuevo: IncidentStatus, nota: string | null, userId: number, ahora: Date): Resolucion {
  return nuevo === 'resolved'
    ? { resolution: nota, resolvedBy: userId, resolvedAt: ahora }
    : { resolution: null, resolvedBy: null, resolvedAt: null };
}
