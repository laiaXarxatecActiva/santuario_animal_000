import type { AnimalStatus } from '../constants/status.js';

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
