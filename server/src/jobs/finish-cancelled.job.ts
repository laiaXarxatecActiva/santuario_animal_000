import { withTransaction } from '../db/transaction.js';
import * as activityModel from '../models/activity-log.model.js';
import * as adoptionModel from '../models/adoption.model.js';
import * as notificationModel from '../models/notification.model.js';
import type { JobDeps } from './job.types.js';

export interface FinishCancelledResult {
  finished: number;
}

/**
 * CU-45 (tarea `finish-cancelled`): las bajas solicitadas terminan al acabar el
 * mes pagado (RN-10) y se despide al adoptante. Idempotente.
 */
export async function runFinishCancelled({ db, reloj }: JobDeps): Promise<FinishCancelledResult> {
  const finished = await withTransaction(db, async (client) => {
    const terminadas = await adoptionModel.finishCancelled(client, reloj.hoy());
    for (const adopcion of terminadas) {
      // CU-42: las tareas automáticas se anotan como «Sistema».
      await activityModel.create(client, {
        userId: null,
        action: 'update',
        tableName: 'adoptions',
        recordId: adopcion.id,
        details: { status: ['active', 'finished'], reason: 'user_cancelled' },
      });
      await notificationModel.create(client, {
        userId: adopcion.userId,
        type: 'adoption_cancelled',
        message: `Tu adopción de ${adopcion.animalName} ha terminado. Gracias por tu apoyo durante este tiempo; puedes volver a adoptar cuando quieras.`,
        link: '/animals',
      });
    }
    return terminadas.length;
  });
  return { finished };
}
