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

/**
 * A mano solo se resuelve una pendiente (abierta o en curso) o se reabre una
 * resuelta. «En curso» no se pone a mano: quiere decir que tiene una tarea pendiente.
 */
export function comprobarCambioDeEstado(
  actual: IncidentStatus,
  nuevo: IncidentStatus,
): 'SAME_STATUS' | 'NOT_RESOLVED' | 'BY_TASK' | null {
  if (nuevo === 'in_progress') return 'BY_TASK';
  if (actual === nuevo) return 'SAME_STATUS';
  if (nuevo === 'open' && actual !== 'resolved') return 'NOT_RESOLVED';
  return null;
}

/** Lo que le pasa a una tarea de una incidencia. */
export type CambioDeTarea = 'completed' | 'not_done' | 'reopened' | 'removed';

/**
 * La incidencia sigue a su tarea: hecha, se resuelve; no hecha (por alguien o por
 * el sistema al acabar el día) o borrada, vuelve a «abierta»; reabierta, vuelve a
 * «en curso». Solo cambia si estaba en curso (o, al reabrir la tarea, si no lo
 * estaba): una resuelta a mano no cambia cuando después se cierra su tarea.
 * Devuelve el nuevo estado o `null` si no cambia.
 */
export function incidenciaTrasLaTarea(actual: IncidentStatus, cambio: CambioDeTarea): IncidentStatus | null {
  if (cambio === 'reopened') return actual === 'in_progress' ? null : 'in_progress';
  if (actual !== 'in_progress') return null;
  return cambio === 'completed' ? 'resolved' : 'open';
}

/** Resuelta por su tarea: la nota de quien la hizo o, sin nota, con qué tarea. */
export function resolucionPorLaTarea(observaciones: string | null, tituloTarea: string): string {
  const nota = observaciones?.trim();
  return nota ? nota : `Resuelta con la tarea «${tituloTarea}».`;
}

/** Observación de la tarea pendiente que se cierra al resolver la incidencia a mano. */
export const TAREA_YA_NO_HACE_FALTA = 'Ya no hace falta: la incidencia se ha resuelto.';

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
