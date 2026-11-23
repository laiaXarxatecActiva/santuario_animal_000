// CU-54 a CU-58: reglas de las plantillas y de las tareas del personal. Sin
// dependencias externas: las fechas son strings `YYYY-MM-DD` y las horas, `HH:MM` de Madrid.
import type { TaskBlockReason, TaskRecurrence, TaskStatus } from '@sanctuary/shared';
import { instanteEnZonaSantuario } from './reloj.js';

/** Cuándo se repite una plantilla. */
export interface Recurrencia {
  recurrence: TaskRecurrence;
  /** 1 = lunes … 7 = domingo; solo con `weekdays`. */
  weekdays: readonly number[] | null;
  /** Solo con `every_n_days`; se cuenta desde `startDate`. */
  intervalDays: number | null;
  startDate: string;
  endDate: string | null;
}

const MS_DIA = 86_400_000;

const aUtc = (fecha: string): number => {
  const [anio, mes, dia] = fecha.split('-').map(Number) as [number, number, number];
  return Date.UTC(anio, mes - 1, dia);
};

const deUtc = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

export function sumarDias(fecha: string, dias: number): string {
  return deUtc(aUtc(fecha) + dias * MS_DIA);
}

/** Días de `desde` a `hasta` (negativo si `hasta` es anterior). */
export function diasEntreFechas(desde: string, hasta: string): number {
  return Math.round((aUtc(hasta) - aUtc(desde)) / MS_DIA);
}

/** Día de la semana ISO: 1 = lunes … 7 = domingo. */
export function diaDeLaSemana(fecha: string): number {
  const dia = new Date(aUtc(fecha)).getUTCDay();
  return dia === 0 ? 7 : dia;
}

/** ¿Hay tarea ese día según la recurrencia y las fechas de la plantilla? */
export function tocaElDia(r: Recurrencia, fecha: string): boolean {
  if (fecha < r.startDate || (r.endDate !== null && fecha > r.endDate)) return false;
  switch (r.recurrence) {
    case 'daily':
      return true;
    case 'weekdays':
      return (r.weekdays ?? []).includes(diaDeLaSemana(fecha));
    case 'every_n_days':
      return r.intervalDays !== null && diasEntreFechas(r.startDate, fecha) % r.intervalDays === 0;
  }
}

/** Fechas con tarea entre `desde` y `hasta`, ambas incluidas. */
export function fechasDeLaPlantilla(r: Recurrencia, desde: string, hasta: string): string[] {
  const fechas: string[] = [];
  for (let fecha = desde; fecha <= hasta; fecha = sumarDias(fecha, 1)) {
    if (tocaElDia(r, fecha)) fechas.push(fecha);
  }
  return fechas;
}

export interface Ocurrencia {
  fecha: string;
  hora: string;
  instante: Date;
}

/**
 * CU-58: tareas que tocan entre dos fechas, ordenadas. Solo las que aún no han
 * pasado (`instante >= ahora`): una plantilla nueva o editada nunca crea
 * tareas atrasadas, y editar una plantilla solo afecta al futuro.
 */
export function ocurrencias(
  plantilla: Recurrencia & { times: readonly string[] },
  desde: string,
  hasta: string,
  ahora: Date,
): Ocurrencia[] {
  const horas = [...plantilla.times].sort();
  const lista: Ocurrencia[] = [];
  for (const fecha of fechasDeLaPlantilla(plantilla, desde, hasta)) {
    for (const hora of horas) {
      const instante = instanteEnZonaSantuario(fecha, hora);
      if (instante.getTime() >= ahora.getTime()) lista.push({ fecha, hora, instante });
    }
  }
  return lista;
}

/** CU-56: pendiente y pasada la hora más el margen de los ajustes (CU-73). */
export function estaAtrasada(tarea: { status: TaskStatus; dueAt: Date }, ahora: Date, margenMinutos: number): boolean {
  return tarea.status === 'pending' && ahora.getTime() > tarea.dueAt.getTime() + margenMinutos * 60_000;
}

/**
 * CU-57: ¿puede un trabajador con estas cualificaciones completar la tarea (o
 * marcarla como no realizada)? Las de días pasados sí; las futuras, no.
 */
export function comprobarResolucion(
  tarea: { status: TaskStatus; dueDate: string; qualificationId: number | null },
  cualificaciones: readonly number[],
  hoy: string,
): TaskBlockReason | null {
  if (tarea.status !== 'pending') return 'NOT_PENDING';
  if (tarea.dueDate > hoy) return 'FUTURE_DAY';
  if (tarea.qualificationId !== null && !cualificaciones.includes(tarea.qualificationId)) {
    return 'MISSING_QUALIFICATION';
  }
  return null;
}

export const MENSAJE_BLOQUEO: Record<TaskBlockReason, string> = {
  NOT_PENDING: 'Esta tarea ya está resuelta.',
  FUTURE_DAY: 'Todavía no se puede hacer: es de otro día.',
  MISSING_QUALIFICATION: 'Esta tarea exige una cualificación que no tienes.',
};

/**
 * CU-54 paso 2: sin zona elegida, la tarea es de la zona donde viven sus
 * animales. `null` si no tienen zona o viven en zonas distintas.
 */
export function zonaComun(animales: readonly { zoneId: number | null }[]): number | null {
  const zonas = new Set(animales.map((a) => a.zoneId));
  if (zonas.size !== 1) return null;
  const [zona] = zonas;
  return zona ?? null;
}
