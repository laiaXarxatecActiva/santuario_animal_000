import type { HistoryQuery, HistoryResponse } from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';
import { inicioDelHistorial } from '../dominio/historial.js';
import { paginar } from '../dominio/paginacion.js';
import type { Reloj } from '../dominio/reloj.js';
import * as historyModel from '../models/adoption-history.model.js';

export interface HistoryServiceDeps {
  db: Queryable;
  reloj: Reloj;
}

// CU-15: historial de «Mis animales», solo del último año y por páginas.
export function createHistoryService({ db, reloj }: HistoryServiceDeps) {
  return {
    async list(userId: number, query: HistoryQuery): Promise<HistoryResponse> {
      const filtros = { since: inicioDelHistorial(reloj), animalId: query.animalId };
      const total = await historyModel.countHistory(db, userId, filtros);
      const pagina = paginar(query, total);
      const data =
        total === 0
          ? []
          : await historyModel.listHistory(db, userId, filtros, { limit: pagina.pageSize, offset: pagina.offset });
      return {
        data,
        meta: {
          page: pagina.page,
          pageSize: pagina.pageSize,
          total,
          totalPages: pagina.totalPages,
          since: filtros.since,
        },
      };
    },
  };
}

export type HistoryService = ReturnType<typeof createHistoryService>;
