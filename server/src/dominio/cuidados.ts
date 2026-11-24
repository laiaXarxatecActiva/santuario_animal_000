// CU-65 a CU-69: reglas de la alimentación, las visitas veterinarias y la
// medicación. Sin dependencias externas: fechas `YYYY-MM-DD` y horas `HH:MM` de Madrid.
import { LOW_INTAKE_LEVELS, type IntakeLevel, type VetVisitStatus } from '@sanctuary/shared';
import { ocurrencias, type Ocurrencia } from './tareas.js';

/** CU-65: un alimento de la dieta vale desde su inicio hasta su fin (ambos incluidos). */
export function dietaVigente(item: { startDate: string; endDate: string | null }, hoy: string): boolean {
  return item.startDate <= hoy && (item.endDate === null || item.endDate >= hoy);
}

/** CU-66: la comida de una tarea es la de sus animales o, si no tiene, la de los que viven en su zona. */
export function animalesDeLaComida<T>(deLaTarea: readonly T[], deLaZona: readonly T[]): T[] {
  return deLaTarea.length > 0 ? [...deLaTarea] : [...deLaZona];
}

export interface Ingesta {
  animalId: number;
  intake: IntakeLevel;
}

/**
 * CU-66: lo que ha comido cada animal de la comida. Lo que no se anota es
 * «todo»; un animal que no es de esa comida es un error.
 */
export function completarIngestas(
  animales: readonly { id: number }[],
  anotadas: readonly Ingesta[],
): { ok: true; ingestas: Ingesta[] } | { ok: false; animalId: number } {
  const ids = new Set(animales.map((a) => a.id));
  const ajena = anotadas.find((i) => !ids.has(i.animalId));
  if (ajena) return { ok: false, animalId: ajena.animalId };
  const porAnimal = new Map(anotadas.map((i) => [i.animalId, i.intake]));
  return { ok: true, ingestas: animales.map((a) => ({ animalId: a.id, intake: porAnimal.get(a.id) ?? 'all' })) };
}

/** CU-67: «menos de la mitad» o «nada». */
export function esIngestaBaja(intake: IntakeLevel): boolean {
  return (LOW_INTAKE_LEVELS as readonly IntakeLevel[]).includes(intake);
}

export interface Racha {
  /** Tomas seguidas comiendo poco, contando desde la última. */
  longitud: number;
  /** La toma con la que empezó la racha (la más antigua de ella). */
  primeraTaskId: number | null;
}

/** CU-67: `tomas`, de la más reciente a la más antigua. */
export function rachaDeComerPoco(tomas: readonly { taskId: number; intake: IntakeLevel }[]): Racha {
  let longitud = 0;
  let primeraTaskId: number | null = null;
  for (const toma of tomas) {
    if (!esIngestaBaja(toma.intake)) break;
    longitud += 1;
    primeraTaskId = toma.taskId;
  }
  return { longitud, primeraTaskId };
}

/** CU-67: cada racha se avisa una sola vez (`staff_alerts.ref_key`). */
export function claveAvisoComePoco(animalId: number, racha: Racha): string {
  return `${animalId}:${racha.primeraTaskId}`;
}

/** CU-67 y CU-69: los administradores y quien tiene turno ese día en la zona, sin repetir. */
export function destinatariosDelAviso(admins: readonly number[], deTurno: readonly number[]): number[] {
  return [...new Set([...admins, ...deTurno])].sort((a, b) => a - b);
}

export type BloqueoVisita = 'NOT_SCHEDULED' | 'FUTURE_DAY';

/** CU-68: una visita se registra si está programada y ya ha llegado su día. */
export function comprobarRegistroVisita(
  visita: { status: VetVisitStatus; date: string },
  hoy: string,
): BloqueoVisita | null {
  if (visita.status !== 'scheduled') return 'NOT_SCHEDULED';
  if (visita.date > hoy) return 'FUTURE_DAY';
  return null;
}

/** CU-69: las dosis de una pauta (cada día, a sus horas) que aún no han pasado. */
export function ocurrenciasDeLaPauta(
  pauta: { times: readonly string[]; startDate: string; endDate: string | null },
  desde: string,
  hasta: string,
  ahora: Date,
): Ocurrencia[] {
  return ocurrencias({ ...pauta, recurrence: 'daily', weekdays: null, intervalDays: null }, desde, hasta, ahora);
}

/** CU-69: activa mientras no haya terminado (también si empieza más adelante). */
export function pautaActiva(pauta: { endDate: string | null }, hoy: string): boolean {
  return pauta.endDate === null || pauta.endDate >= hoy;
}

export type BloqueoTerminar = 'NOT_STARTED' | 'ALREADY_ENDED';

/** CU-69: terminar una pauta la cierra hoy; si aún no ha empezado, se borra. */
export function comprobarTerminarPauta(
  pauta: { startDate: string; endDate: string | null },
  hoy: string,
): BloqueoTerminar | null {
  if (pauta.startDate > hoy) return 'NOT_STARTED';
  if (pauta.endDate !== null && pauta.endDate < hoy) return 'ALREADY_ENDED';
  return null;
}

/** CU-69: el título de cada dosis en «Mi día». */
export function tituloDeLaDosis(medicamento: string, dosis: string): string {
  return `${medicamento} · ${dosis}`;
}
