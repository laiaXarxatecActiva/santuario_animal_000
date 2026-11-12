import { ARCHIVED_ANIMAL_STATUSES, type AdoptionEndReason, type AnimalStatus } from '@sanctuary/shared';

/** RN-22: fallecido o trasladado. */
export function estaArchivado(status: AnimalStatus): boolean {
  return (ARCHIVED_ANIMAL_STATUSES as readonly AnimalStatus[]).includes(status);
}

/** CU-28 2b: un animal archivado no puede admitir adopciones. */
export function puedeSerAdoptable(status: AnimalStatus, isAdoptable: boolean): boolean {
  return !isAdoptable || !estaArchivado(status);
}

/** CU-33 precondición: solo cambia de estado un animal que no está archivado. */
export function puedeCambiarDeEstado(actual: AnimalStatus): boolean {
  return !estaArchivado(actual);
}

/** CU-33 5.2: motivo con el que se cierran las adopciones abiertas, o `null` si no se cierran. */
export function motivoDeCierre(nuevo: AnimalStatus): AdoptionEndReason | null {
  if (nuevo === 'deceased') return 'animal_deceased';
  if (nuevo === 'transferred') return 'animal_transferred';
  return null;
}

/** CU-28 A4 y RN-17: solo se borra un animal que nunca ha tenido adopciones. */
export function sePuedeBorrar(tieneHistorialDeAdopciones: boolean): boolean {
  return !tieneHistorialDeAdopciones;
}
