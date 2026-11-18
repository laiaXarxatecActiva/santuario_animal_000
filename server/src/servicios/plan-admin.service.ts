import type { AdminPlanDto } from '@sanctuary/shared';
import type { Pool, PoolClient } from 'pg';
import { withTransaction } from '../db/transaction.js';
import { comprobarAltaPlan, comprobarEdicionPlan, type ProblemaPlan } from '../dominio/planes.js';
import {
  DefaultPlanMustBeActiveError,
  DefaultPlanNeedsReplacementError,
  NotFoundError,
  PlanAmountChangeUnconfirmedError,
} from '../errors/app-error.js';
import * as planModel from '../models/adoption-plan.model.js';
import type { PlanData } from '../models/adoption-plan.model.js';

export interface PlanAdminServiceDeps {
  db: Pool;
}

export type PlanAdminService = ReturnType<typeof createPlanAdminService>;

function lanzar(problema: ProblemaPlan, activeAdoptions: number): never {
  switch (problema) {
    case 'DEFAULT_MUST_BE_ACTIVE':
      throw new DefaultPlanMustBeActiveError();
    case 'DEFAULT_NEEDS_REPLACEMENT':
      throw new DefaultPlanNeedsReplacementError();
    case 'AMOUNT_CHANGE_UNCONFIRMED':
      throw new PlanAmountChangeUnconfirmedError(activeAdoptions);
  }
}

// CU-40 Gestionar planes de adopción (solo administradores).
export function createPlanAdminService({ db }: PlanAdminServiceDeps) {
  async function leer(client: PoolClient, id: number): Promise<AdminPlanDto> {
    const plan = await planModel.findWithCount(client, id);
    if (!plan) throw new NotFoundError('Este plan no existe.');
    return plan;
  }

  return {
    list: async () => ({ data: await planModel.listWithCounts(db) }),

    /** A2: siempre mensual. Si es el nuevo plan por defecto, el anterior deja de serlo. */
    async create(datos: PlanData): Promise<AdminPlanDto> {
      const problema = comprobarAltaPlan(datos);
      if (problema) lanzar(problema, 0);
      return withTransaction(db, async (client) => {
        if (datos.isDefault) await planModel.clearDefaultExcept(client, null);
        return leer(client, await planModel.create(client, datos));
      });
    },

    /** 3, 3a y A1. Las adopciones existentes siguen con su plan aunque se desactive. */
    async update(id: number, datos: PlanData & { confirmAmountChange: boolean }): Promise<AdminPlanDto> {
      return withTransaction(db, async (client) => {
        const actual = await planModel.findWithCount(client, id, true);
        if (!actual) throw new NotFoundError('Este plan no existe.');
        const problema = comprobarEdicionPlan(actual, datos);
        if (problema) lanzar(problema, actual.activeAdoptions);
        if (datos.isDefault && !actual.isDefault) await planModel.clearDefaultExcept(client, id);
        await planModel.update(client, id, datos);
        return leer(client, id);
      });
    },
  };
}
