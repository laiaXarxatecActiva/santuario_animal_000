import type { VetRecordType } from '../constants/animals.js';
import type { AdminPersonRef } from './admin.js';

/** CU-34: registro del historial veterinario (interno: nunca lo ven los adoptantes). */
export interface VetRecordDto {
  id: number;
  animalId: number;
  /** `YYYY-MM-DD`. */
  recordDate: string;
  type: VetRecordType;
  description: string;
  /** Kg como string (`NUMERIC`), o `null` si no se pesó. */
  weightKg: string | null;
  veterinarian: string | null;
  createdBy: AdminPersonRef | null;
  createdAt: string;
  updatedAt: string;
}
