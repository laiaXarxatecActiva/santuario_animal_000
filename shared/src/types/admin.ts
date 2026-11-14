import type { AnimalSex } from '../constants/animals.js';
import type { AnimalStatus } from '../constants/status.js';
import type { PhotoDto } from './public.js';

export type UpdateAlertLevel = 'warning' | 'error';

/** CU-27: animal con adoptantes activos que necesita una actualización (RN-14). */
export interface UpdateAlertDto {
  animal: { id: number; name: string };
  daysWithoutUpdate: number;
  level: UpdateAlertLevel;
  activeAdopters: number;
}

/** GET /api/admin/dashboard (CU-27). Los ingresos llegan en la fase 2. */
export interface DashboardDto {
  animalsByStatus: Record<AnimalStatus, number>;
  activeAdoptions: number;
  pendingAdoptions: number;
  updateAlerts: UpdateAlertDto[];
}

/** Especie en el panel (CU-30). */
export interface SpeciesAdminDto {
  id: number;
  name: string;
  scientificName: string | null;
  description: string | null;
  animalCount: number;
}

/** Fila del listado de animales del panel (CU-28). */
export interface AdminAnimalListItemDto {
  id: number;
  name: string;
  species: { id: number; name: string };
  status: AnimalStatus;
  isPublished: boolean;
  isAdoptable: boolean;
  activeAdopters: number;
  coverPhoto: PhotoDto | null;
}

/** Ficha completa del animal en el panel (CU-28). */
export interface AdminAnimalDto extends AdminAnimalListItemDto {
  breed: string | null;
  sex: AnimalSex;
  approxBirthDate: string | null;
  arrivalDate: string;
  rescueStory: string | null;
  temperament: string | null;
  specialNeeds: string | null;
  healthSummary: string | null;
  /** Fecha del fallecimiento o traslado. */
  statusChangedAt: string | null;
  /** Adopciones pendientes, activas o pausadas: las que cerraría un fallecimiento o traslado. */
  openAdoptions: number;
  /** Ha tenido alguna adopción: entonces no se puede borrar (RN-17). */
  hasAdoptionHistory: boolean;
}

/** Foto o vídeo de la galería en el panel (CU-29). */
export interface AdminPhotoDto extends PhotoDto {
  sortOrder: number;
  isCover: boolean;
}

/** CU-29 2a: archivo rechazado en una subida. */
export interface RejectedFileDto {
  fileName: string;
  code: 'UNSUPPORTED_FORMAT' | 'IMAGE_TOO_LARGE' | 'VIDEO_TOO_LARGE' | 'INVALID_FILE';
  message: string;
}

/** POST /api/admin/animals/:id/photos: los creados y los rechazados. */
export interface PhotoUploadResultDto {
  created: AdminPhotoDto[];
  rejected: RejectedFileDto[];
}
