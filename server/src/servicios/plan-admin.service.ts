import type { AdminPlanDto } from '@sanctuary/shared';
import type { Pool, PoolClient } from 'pg';
import { withTransaction } from '../db/transaction.js';
import {
  comprobarAltaPlan,
  comprobarBorradoPlan,
  comprobarEdicionPlan,
  comprobarPlanes,
  type ProblemaPlan,
} from '../dominio/planes.js';
import {
  AppError,
  DefaultPlanCannotBeDeletedError,
  DefaultPlanMustBeActiveError,
  DefaultPlanNeedsReplacementError,
  DefaultPlanNotUniqueError,
  NotFoundError,
  PlanAmountChangeUnconfirmedError,
  PlanHasHistoryError,
} from '../errors/app-error.js';
import * as planModel from '../models/adoption-plan.model.js';
import type { PlanData } from '../models/adoption-plan.model.js';

export interface PlanAdminServiceDeps {
  db: Pool;
}

export type PlanAdminService = ReturnType<typeof createPlanAdminService>;

/** `prefijo` sitúa el error en un plan del formulario de todos los planes (`plans.1.`). */
function lanzar(problema: ProblemaPlan, activeAdoptions: number, prefijo = ''): never {
  switch (problema) {
    case 'DEFAULT_MUST_BE_ACTIVE':
      throw new DefaultPlanMustBeActiveError(`${prefijo}isActive`);
    case 'DEFAULT_NEEDS_REPLACEMENT':
      throw new DefaultPlanNeedsReplacementError(`${prefijo}isDefault`);
    case 'DEFAULT_NOT_UNIQUE':
      throw new DefaultPlanNotUniqueError(`${prefijo}isDefault`);
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

    /**
     * Guarda todos los planes a la vez (un solo «Guardar cambios»): o se guardan
     * todos o ninguno. Devuelve los planes como quedan.
     */
    async updateAll(
      planes: (PlanData & { id: number })[],
      confirmAmountChange: boolean,
    ): Promise<{ data: AdminPlanDto[] }> {
      return withTransaction(db, async (client) => {
        await client.query('SELECT 1 FROM adoption_plans ORDER BY id FOR UPDATE');
        const guardados = await planModel.listWithCounts(client);
        if (planes.some((p) => !guardados.some((g) => g.id === p.id))) throw new NotFoundError('Este plan no existe.');
        const problema = comprobarPlanes(guardados, planes, confirmAmountChange);
        if (problema) {
          const indice = planes.findIndex((p) => p.id === problema.planId);
          lanzar(problema.problema, problema.activeAdoptions ?? 0, indice >= 0 ? `plans.${indice}.` : '');
        }
        // Primero se quita la marca al anterior: solo puede haber un plan por defecto.
        const nuevoPorDefecto = planes.find((p) => p.isDefault);
        if (nuevoPorDefecto) await planModel.clearDefaultExcept(client, nuevoPorDefecto.id);
        for (const [indice, { id, ...datos }] of planes.entries()) {
          try {
            await planModel.update(client, id, datos);
          } catch (error) {
            // El error del nombre repetido se sitúa en su plan.
            if (error instanceof AppError) {
              throw new AppError(
                error.status,
                error.code,
                error.message,
                error.details.map((d) => ({ ...d, field: `plans.${indice}.${d.field}` })),
              );
            }
            throw error;
          }
        }
        return { data: await planModel.listWithCounts(client) };
      });
    },

    /**
     * A3: borra para siempre un plan que nunca se ha usado (RN-17) y que no es el
     * de por defecto. Devuelve lo que tenía, para el registro de actividad.
     */
    async remove(id: number): Promise<{ name: string; monthlyAmount: string }> {
      return withTransaction(db, async (client) => {
        const plan = await planModel.findForDeletion(client, id);
        if (!plan) throw new NotFoundError('Este plan no existe.');
        const problema = comprobarBorradoPlan(plan);
        if (problema === 'DEFAULT_CANNOT_BE_DELETED') throw new DefaultPlanCannotBeDeletedError();
        if (problema === 'HAS_HISTORY') throw new PlanHasHistoryError();
        await planModel.remove(client, id);
        return { name: plan.name, monthlyAmount: plan.monthlyAmount };
      });
    },
  };
}
