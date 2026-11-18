import { withTransaction } from '../db/transaction.js';
import { limitePagoPendiente } from '../dominio/adopcion.js';
import * as activityModel from '../models/activity-log.model.js';
import * as adoptionModel from '../models/adoption.model.js';
import * as notificationModel from '../models/notification.model.js';
import * as tokenModel from '../models/user-token.model.js';
import type { JobDeps } from './job.types.js';
import { avisos } from '../servicios/textos-avisos.js';

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
      // CU-42: las tareas automáticas se anotan como «Sistema».
      await activityModel.create(client, {
        userId: null,
        action: 'update',
        tableName: 'adoptions',
        recordId: adopcion.id,
        details: { status: ['pending', 'cancelled'], reason: 'payment_not_completed' },
      });
      await notificationModel.create(client, {
        userId: adopcion.userId,
        type: 'adoption_cancelled',
        message: avisos.caducada(adopcion.animalName),
        link: `/animals/${adopcion.animalId}`,
      });
    }
    return cerradas.length;
  });
  const expiredTokensDeleted = await tokenModel.deleteExpired(db, reloj.ahora());
  return { cancelled: canceladas, expiredTokensDeleted };
}
