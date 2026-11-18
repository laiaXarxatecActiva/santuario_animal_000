import type { AdminStatsDto, AdminStatsQuery } from '@sanctuary/shared';
import type { Pool } from 'pg';
import {
  MAX_MESES_ESTADISTICAS,
  MENSAJE_RANGO_LARGO,
  mesesDelRango,
  rangoEstadisticas,
} from '../dominio/estadisticas.js';
import type { Reloj } from '../dominio/reloj.js';
import { ValidationError } from '../errors/app-error.js';
import * as statsModel from '../models/stats.model.js';

const MAS_ADOPTADOS = 5;

export type StatsAdminService = ReturnType<typeof createStatsAdminService>;

// CU-41 Consultar estadísticas (solo lectura).
export function createStatsAdminService({ db, reloj }: { db: Pool; reloj: Reloj }) {
  return {
    async get(query: AdminStatsQuery): Promise<AdminStatsDto> {
      const rango = rangoEstadisticas(query, reloj.hoy());
      if (mesesDelRango(rango) > MAX_MESES_ESTADISTICAS) {
        throw new ValidationError([{ field: 'from', message: MENSAJE_RANGO_LARGO }]);
      }
      const [revenueByMonth, adoptionsByMonth, mostAdopted, withoutAdopters, activeByPlan] = await Promise.all([
        statsModel.revenueByMonth(db, rango),
        statsModel.adoptionsByMonth(db, rango),
        statsModel.mostAdopted(db, MAS_ADOPTADOS),
        statsModel.withoutAdopters(db),
        statsModel.activeByPlan(db),
      ]);
      return {
        range: { from: rango.desde.slice(0, 7), to: rango.hasta.slice(0, 7) },
        revenueByMonth,
        adoptionsByMonth,
        mostAdopted,
        withoutAdopters,
        activeByPlan,
      };
    },
  };
}
