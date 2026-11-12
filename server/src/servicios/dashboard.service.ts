import { ANIMAL_STATUSES, type DashboardDto, type UpdateAlertDto } from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';
import { diasEntre, nivelAlertaActualizacion } from '../dominio/actualizaciones.js';
import type { Reloj } from '../dominio/reloj.js';
import * as dashboardModel from '../models/dashboard.model.js';

export interface DashboardServiceDeps {
  db: Queryable;
  reloj: Reloj;
}

export type DashboardService = ReturnType<typeof createDashboardService>;

// CU-27: escritorio del panel (versión de la fase 1, sin ingresos).
export function createDashboardService({ db, reloj }: DashboardServiceDeps) {
  return {
    async get(): Promise<DashboardDto> {
      const [porEstado, adopciones, animales] = await Promise.all([
        dashboardModel.countAnimalsByStatus(db),
        dashboardModel.countAdoptions(db),
        dashboardModel.listAnimalsWithActiveAdopters(db),
      ]);
      const hoy = reloj.hoy();
      const updateAlerts: UpdateAlertDto[] = animales
        .map((a) => {
          const daysWithoutUpdate = diasEntre(a.referenceDate, hoy);
          const level = nivelAlertaActualizacion(daysWithoutUpdate);
          return (
            level && { animal: { id: a.id, name: a.name }, daysWithoutUpdate, level, activeAdopters: a.activeAdopters }
          );
        })
        .filter((a): a is UpdateAlertDto => a !== null)
        // Primero los que llevan más tiempo sin noticias.
        .sort((x, y) => y.daysWithoutUpdate - x.daysWithoutUpdate || x.animal.id - y.animal.id);
      return {
        animalsByStatus: Object.fromEntries(
          ANIMAL_STATUSES.map((s) => [s, porEstado[s] ?? 0]),
        ) as DashboardDto['animalsByStatus'],
        activeAdoptions: adopciones.active,
        pendingAdoptions: adopciones.pending,
        updateAlerts,
      };
    },
  };
}
