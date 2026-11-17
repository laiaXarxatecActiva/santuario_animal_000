import { withTransaction } from '../db/transaction.js';
import { limitePagoPendiente } from '../dominio/adopcion.js';
import * as adoptionModel from '../models/adoption.model.js';
import * as notificationModel from '../models/notification.model.js';
import * as tokenModel from '../models/user-token.model.js';
import type { JobDeps } from './job.types.js';

export interface ExpirePendingResult {
  cancelled: number;
  expiredTokensDeleted: number;
}

/**
 * CU-44 (tarea `expire-pending`): cancela las adopciones pendientes de más de
 * 7 días (RN-07), avisa a sus adoptantes y borra los tokens caducados.
 * Idempotente: una adopción ya cancelada no se vuelve a tocar.
 */
export async function runExpirePending({ db, reloj }: JobDeps): Promise<ExpirePendingResult> {
  const canceladas = await withTransaction(db, async (client) => {
    const cerradas = await adoptionModel.cancelExpiredPending(client, limitePagoPendiente(reloj.ahora()), reloj.hoy());
    for (const adopcion of cerradas) {
      await notificationModel.create(client, {
        userId: adopcion.userId,
        type: 'adoption_cancelled',
        message: `Tu adopción de ${adopcion.animalName} se ha cancelado porque no se completó el pago en 7 días. Puedes intentarlo de nuevo cuando quieras.`,
        link: `/animals/${adopcion.animalId}`,
      });
    }
    return cerradas.length;
  });
  const expiredTokensDeleted = await tokenModel.deleteExpired(db, reloj.ahora());
  return { cancelled: canceladas, expiredTokensDeleted };
}
