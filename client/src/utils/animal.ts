import { ARCHIVED_ANIMAL_STATUSES, type AnimalStatus } from '@sanctuary/shared';

/** RN-22: fallecido o trasladado. Su información solo se consulta (lo comprueba también el servidor). */
export const esArchivado = (status: AnimalStatus): boolean =>
  (ARCHIVED_ANIMAL_STATUSES as readonly AnimalStatus[]).includes(status);
