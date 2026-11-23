import { withTransaction } from '../db/transaction.js';
import {
  cuotaManualVencida,
  debeAvisarCuotaManual,
  DIAS_AVISO_CUOTA_MANUAL,
  limiteCuotaManual,
  sumarDias,
} from '../dominio/adopcion.js';
import * as activityModel from '../models/activity-log.model.js';
import * as adoptionModel from '../models/adoption.model.js';
import * as notificationModel from '../models/notification.model.js';
import * as userModel from '../models/user.model.js';
import { manualPaymentDueEmail, manualPaymentOverdueEmail } from '../services/email/templates/manual-payment.js';
import { avisos } from '../servicios/textos-avisos.js';
import type { JobDeps } from './job.types.js';

export interface ManualPaymentsResult {
  /** Cuotas manuales avisadas (7 días antes). */
  reminded: number;
  /** Adopciones pausadas por no pagar la cuota manual en el plazo. */
  paused: number;
  /** Adopciones con un error inesperado: se deshacen y se reintentan al día siguiente. */
  errors: number;
}

type Resultado = { tipo: 'avisada' | 'pausada'; email?: () => Promise<void> } | null;

/**
 * CU-50 (tarea `manual-payments`): en las adopciones con pago manual (CU-49),
 * avisa de la cuota 7 días antes y, si pasan 7 días desde la cuota sin pagarla,
 * pausa la adopción. Cada adopción va en su propia transacción, con su fila
 * bloqueada. Es idempotente: el aviso se anota (`payment_reminder_sent_for`) y
 * una adopción pausada ya no se vuelve a pausar.
 */
export async function runManualPayments({
  db,
  reloj,
  email,
  clientUrl,
  logError = () => {},
}: JobDeps): Promise<ManualPaymentsResult> {
  const hoy = reloj.hoy();
  const resumen: ManualPaymentsResult = { reminded: 0, paused: 0, errors: 0 };
  const misAnimales = new URL('/my-animals', clientUrl).toString();

  function revisar(adoptionId: number): Promise<Resultado> {
    return withTransaction(db, async (client) => {
      const adopcion = await adoptionModel.findByIdForUpdate(client, adoptionId);
      if (!adopcion?.nextBillingDate) return null;
      const estado = { ...adopcion, cancelRequested: adopcion.cancelRequestedAt !== null };
      const cuota = adopcion.nextBillingDate;
      const plan = adopcion.nextPlan ?? adopcion.plan;
      const user = await userModel.findById(client, adopcion.userId);
      const datos = {
        firstName: user?.firstName ?? '',
        animalName: adopcion.animal.name,
        amount: plan.monthlyAmount,
        url: misAnimales,
        language: user?.preferredLanguage,
      };

      if (cuotaManualVencida(estado, hoy)) {
        await adoptionModel.pause(client, adoptionId);
        // CU-42: las tareas automáticas se anotan como «Sistema».
        await activityModel.create(client, {
          userId: null,
          action: 'update',
          tableName: 'adoptions',
          recordId: adoptionId,
          details: { status: ['active', 'paused'], reason: 'manual_payment_overdue' },
        });
        await notificationModel.create(client, {
          userId: adopcion.userId,
          type: 'payment_failed',
          message: avisos.cuotaManualVencida(adopcion.animal.name),
          link: `/my-animals/${adopcion.animal.id}`,
        });
        // Los emails de pagos se envían siempre, sin mirar las preferencias (RN-19).
        return {
          tipo: 'pausada',
          email: user ? () => email.send({ to: user.email, ...manualPaymentOverdueEmail(datos) }) : undefined,
        };
      }

      if (debeAvisarCuotaManual(estado, hoy)) {
        const limite = limiteCuotaManual(cuota);
        await adoptionModel.setReminderSentFor(client, adoptionId, cuota);
        await notificationModel.create(client, {
          userId: adopcion.userId,
          type: 'system',
          message: avisos.cuotaManualPendiente(adopcion.animal.name, cuota, limite),
          link: '/my-animals',
        });
        const aviso = { ...datos, dueDate: cuota, deadline: limite };
        return {
          tipo: 'avisada',
          email: user ? () => email.send({ to: user.email, ...manualPaymentDueEmail(aviso) }) : undefined,
        };
      }
      return null;
    });
  }

  for (const adoptionId of await adoptionModel.listManualDueBy(db, sumarDias(hoy, DIAS_AVISO_CUOTA_MANUAL))) {
    try {
      const resultado = await revisar(adoptionId);
      if (!resultado) continue;
      if (resultado.tipo === 'avisada') resumen.reminded++;
      else resumen.paused++;
      if (resultado.email) {
        try {
          await resultado.email();
        } catch (error) {
          logError(error, 'manual-payments: no se ha podido enviar un email');
        }
      }
    } catch (error) {
      resumen.errors++;
      logError(error, `manual-payments: error con la adopción ${adoptionId}`);
    }
  }
  return resumen;
}
