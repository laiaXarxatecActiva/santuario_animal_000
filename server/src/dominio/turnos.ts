import type { CopySkipReason } from '@sanctuary/shared';
import { diaDeLaSemana, sumarDias } from './tareas.js';

// Reglas de los turnos y las ausencias (CU-60 a CU-64). Sin dependencias
// externas: las horas son `HH:MM` y las fechas `YYYY-MM-DD` de Madrid.

/** Franja horaria de un mismo día: de `inicio` (incluido) a `fin` (sin incluir). */
export interface Franja {
  inicio: string;
  fin: string;
}

/** Dos franjas se solapan si comparten algún minuto; tocarse no es solaparse. */
export const seSolapan = (a: Franja, b: Franja): boolean => a.inicio < b.fin && b.inicio < a.fin;

/** El lunes de la semana de una fecha. */
export const lunesDe = (fecha: string): string => sumarDias(fecha, 1 - diaDeLaSemana(fecha));

/** ¿Se hace este turno ese día de la semana? */
export const seHaceEl = (weekdays: readonly number[], fecha: string): boolean =>
  weekdays.includes(diaDeLaSemana(fecha));

export interface TurnoParaCalendario extends Franja {
  id: number;
  weekdays: readonly number[];
  isActive: boolean;
  requisitos: readonly { zoneId: number; minWorkers: number }[];
}

export interface Hueco {
  date: string;
  shiftId: number;
  zoneId: number;
  required: number;
  assigned: number;
}

/**
 * CU-61 y CU-64: las zonas de cada turno activo, en cada fecha en que se hace,
 * con menos personas de las que necesitan. En el orden de `fechas`, de `turnos`
 * y de sus requisitos.
 */
export function huecos(
  turnos: readonly TurnoParaCalendario[],
  asignaciones: readonly { shiftId: number; date: string; zoneIds: readonly number[] }[],
  fechas: readonly string[],
): Hueco[] {
  const resultado: Hueco[] = [];
  for (const date of fechas) {
    for (const turno of turnos) {
      if (!turno.isActive || !seHaceEl(turno.weekdays, date)) continue;
      const delDia = asignaciones.filter((a) => a.shiftId === turno.id && a.date === date);
      for (const { zoneId, minWorkers } of turno.requisitos) {
        const assigned = delDia.filter((a) => a.zoneIds.includes(zoneId)).length;
        if (assigned < minWorkers) resultado.push({ date, shiftId: turno.id, zoneId, required: minWorkers, assigned });
      }
    }
  }
  return resultado;
}

/** CU-63: por qué no se puede fichar. */
export type MotivoFichaje = 'SHIFT_NOT_TODAY' | 'ALREADY_CHECKED_IN' | 'NOT_CHECKED_IN' | 'ALREADY_CHECKED_OUT';

export function comprobarEntrada(a: { date: string; checkedInAt: string | null }, hoy: string): MotivoFichaje | null {
  if (a.date !== hoy) return 'SHIFT_NOT_TODAY';
  if (a.checkedInAt !== null) return 'ALREADY_CHECKED_IN';
  return null;
}

export function comprobarSalida(
  a: { date: string; checkedInAt: string | null; checkedOutAt: string | null },
  hoy: string,
): MotivoFichaje | null {
  if (a.date !== hoy) return 'SHIFT_NOT_TODAY';
  if (a.checkedInAt === null) return 'NOT_CHECKED_IN';
  if (a.checkedOutAt !== null) return 'ALREADY_CHECKED_OUT';
  return null;
}

/**
 * CU-56: una tarea sin asignar es de quien tiene un turno en su zona y cuya
 * franja contiene la hora de la tarea.
 */
export function esDeMiTurno(
  tarea: { zoneId: number | null; dueTime: string },
  turnos: readonly (Franja & { zoneIds: readonly number[] })[],
): boolean {
  if (tarea.zoneId === null) return false;
  const zona = tarea.zoneId;
  return turnos.some((t) => t.zoneIds.includes(zona) && t.inicio <= tarea.dueTime && tarea.dueTime < t.fin);
}

export interface AsignacionACopiar {
  shiftId: number;
  date: string;
  userId: number;
  zoneIds: number[];
}

export interface ContextoCopia {
  hoy: string;
  turnos: ReadonlyMap<number, TurnoParaCalendario>;
  usuariosActivos: ReadonlySet<number>;
  ausencias: readonly { userId: number; startDate: string; endDate: string }[];
  /** Lo que ya hay en la semana de destino. */
  existentes: readonly { shiftId: number; date: string; userId: number }[];
}

/**
 * CU-61 «Copiar la semana anterior»: cada turno pasa a 7 días después. No se
 * borra nada; se salta lo que no tiene sentido y se dice por qué.
 */
export function planificarCopia(
  origen: readonly AsignacionACopiar[],
  ctx: ContextoCopia,
): { crear: AsignacionACopiar[]; saltar: (Omit<AsignacionACopiar, 'zoneIds'> & { reason: CopySkipReason })[] } {
  const crear: AsignacionACopiar[] = [];
  const saltar: (Omit<AsignacionACopiar, 'zoneIds'> & { reason: CopySkipReason })[] = [];
  const ocupados = [...ctx.existentes];

  for (const a of origen) {
    const date = sumarDias(a.date, 7);
    const turno = ctx.turnos.get(a.shiftId);
    const motivo = ((): CopySkipReason | null => {
      if (date < ctx.hoy) return 'PAST';
      if (!turno || !turno.isActive) return 'INACTIVE_SHIFT';
      if (!seHaceEl(turno.weekdays, date)) return 'NOT_THAT_WEEKDAY';
      if (!ctx.usuariosActivos.has(a.userId)) return 'INACTIVE_USER';
      if (ctx.ausencias.some((x) => x.userId === a.userId && x.startDate <= date && date <= x.endDate)) return 'ABSENT';
      const suyos = ocupados.filter((o) => o.userId === a.userId && o.date === date);
      if (suyos.some((o) => o.shiftId === a.shiftId)) return 'ALREADY_ASSIGNED';
      if (
        suyos.some((o) => {
          const otro = ctx.turnos.get(o.shiftId);
          return otro !== undefined && seSolapan(otro, turno);
        })
      ) {
        return 'OVERLAP';
      }
      return null;
    })();
    if (motivo) {
      saltar.push({ shiftId: a.shiftId, date, userId: a.userId, reason: motivo });
    } else {
      crear.push({ ...a, date });
      ocupados.push({ shiftId: a.shiftId, date, userId: a.userId });
    }
  }
  return { crear, saltar };
}
