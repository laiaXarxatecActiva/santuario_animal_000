import { withTransaction } from '../db/transaction.js';
import { debeCobrarse, periodoCuota } from '../dominio/adopcion.js';
import * as activityModel from '../models/activity-log.model.js';
import * as adoptionModel from '../models/adoption.model.js';
import * as notificationModel from '../models/notification.model.js';
import * as paymentModel from '../models/payment.model.js';
import * as userModel from '../models/user.model.js';
import { paymentCompletedEmail } from '../services/email/templates/payment-completed.js';
import { paymentFailedEmail } from '../services/email/templates/payment-failed.js';
import type { JobDeps } from './job.types.js';
import { avisos } from '../servicios/textos-avisos.js';

export interface BillingResult {
  /** Cuotas cobradas. */
  charged: number;
  /** Cuotas fallidas (adopción pausada). */
  failed: number;
  /** Periodos que ya estaban pagados (la tarea se había ejecutado antes). */
  alreadyPaid: number;
  /** Adopciones con un error inesperado: se deshacen y se reintentan al día siguiente. */
  errors: number;
}

/** Como mucho se ponen al día dos años de cuotas atrasadas en una ejecución. */
const MAX_CUOTAS_POR_ADOPCION = 24;

type Resultado = { tipo: 'cobrada' | 'fallida' | 'yaPagada'; email?: () => Promise<void> } | null;

/**
 * CU-43 (tarea `billing`): cobra las cuotas vencidas de las adopciones activas.
 * Cada cuota va en su propia transacción, con la fila de la adopción bloqueada,
 * así que dos ejecuciones a la vez no cobran dos veces. Es idempotente: un
 * periodo ya pagado no se vuelve a cobrar.
 */
export async function runBilling({
  db,
  reloj,
  payments,
  email,
  clientUrl,
  logError = () => {},
}: JobDeps): Promise<BillingResult> {
  const hoy = reloj.hoy();
  const resumen: BillingResult = { charged: 0, failed: 0, alreadyPaid: 0, errors: 0 };

  async function enviar(enviarEmail: () => Promise<void>): Promise<void> {
    try {
      await enviarEmail();
    } catch (error) {
      logError(error, 'billing: no se ha podido enviar un email');
    }
  }

  /** Procesa la cuota vencida más antigua de una adopción. `null` si ya no hay nada que cobrar. */
  function cobrarUnaCuota(adoptionId: number): Promise<Resultado> {
    return withTransaction(db, async (client) => {
      const adopcion = await adoptionModel.findByIdForUpdate(client, adoptionId);
      if (!adopcion) return null;
      const estado = { ...adopcion, cancelRequested: adopcion.cancelRequestedAt !== null };
      if (!debeCobrarse(estado, hoy) || adopcion.nextBillingDate === null) return null;

      const periodo = periodoCuota(adopcion.nextBillingDate);
      // 2a: el periodo ya está pagado; solo se avanza la fecha.
      if (await paymentModel.existsValidForPeriod(client, adoptionId, periodo.periodStart)) {
        await adoptionModel.setNextBillingDate(client, adoptionId, periodo.nextBillingDate);
        return { tipo: 'yaPagada' };
      }

      // 1: el cambio de plan programado se aplica en este cobro.
      const plan = adopcion.nextPlan ?? adopcion.plan;
      if (adopcion.nextPlan) await adoptionModel.applyNextPlan(client, adoptionId);

      const resultado = await payments.charge({
        amount: plan.monthlyAmount,
        description: `Cuota ${plan.name} - ${adopcion.animal.name} - ${periodo.periodStart.slice(0, 7)}`,
      });
      await paymentModel.create(client, {
        adoptionId,
        planId: plan.id,
        amount: plan.monthlyAmount,
        periodStart: periodo.periodStart,
        periodEnd: periodo.periodEnd,
        status: resultado.success ? 'completed' : 'failed',
        reference: resultado.reference,
        failureReason: resultado.success ? null : (resultado.failureReason ?? 'Pago rechazado'),
        paidAt: resultado.success ? reloj.ahora() : null,
      });

      const user = await userModel.findById(client, adopcion.userId);
      const ficha = `/my-animals/${adopcion.animal.id}`;
      const url = new URL(ficha, clientUrl).toString();

      if (resultado.success) {
        await adoptionModel.setNextBillingDate(client, adoptionId, periodo.nextBillingDate);
        await notificationModel.create(client, {
          userId: adopcion.userId,
          type: 'payment_completed',
          message: avisos.cuotaCobrada(adopcion.animal.name),
          link: ficha,
        });
        // Los emails de pagos se envían siempre, sin mirar las preferencias (RN-19).
        const recibo = {
          firstName: user?.firstName ?? '',
          animalName: adopcion.animal.name,
          planName: plan.name,
          amount: plan.monthlyAmount,
          ...periodo,
          reference: resultado.reference,
          url: new URL('/my-animals', clientUrl).toString(),
          language: user?.preferredLanguage,
        };
        return {
          tipo: 'cobrada',
          email: user ? () => email.send({ to: user.email, ...paymentCompletedEmail(recibo) }) : undefined,
        };
      }

      // 3a: cuota fallida → adopción pausada hasta que se regularice (CU-14).
      await adoptionModel.pause(client, adoptionId);
      // CU-42: las tareas automáticas se anotan como «Sistema».
      await activityModel.create(client, {
        userId: null,
        action: 'update',
        tableName: 'adoptions',
        recordId: adoptionId,
        details: { status: ['active', 'paused'], reason: 'payment_failed' },
      });
      await notificationModel.create(client, {
        userId: adopcion.userId,
        type: 'payment_failed',
        message: avisos.cuotaFallida(adopcion.animal.name),
        link: ficha,
      });
      const aviso = {
        firstName: user?.firstName ?? '',
        animalName: adopcion.animal.name,
        amount: plan.monthlyAmount,
        url,
        language: user?.preferredLanguage,
      };
      return {
        tipo: 'fallida',
        email: user ? () => email.send({ to: user.email, ...paymentFailedEmail(aviso) }) : undefined,
      };
    });
  }

  for (const adoptionId of await adoptionModel.listDueForBilling(db, hoy)) {
    try {
      // Se repite mientras queden cuotas atrasadas (postcondición: ninguna activa con la cuota vencida).
      for (let i = 0; i < MAX_CUOTAS_POR_ADOPCION; i++) {
        const resultado = await cobrarUnaCuota(adoptionId);
        if (!resultado) break;
        if (resultado.email) await enviar(resultado.email);
        if (resultado.tipo === 'cobrada') resumen.charged++;
        else if (resultado.tipo === 'yaPagada') resumen.alreadyPaid++;
        else {
          resumen.failed++;
          break;
        }
      }
    } catch (error) {
      resumen.errors++;
      logError(error, `billing: error al cobrar la adopción ${adoptionId}`);
    }
  }
  return resumen;
}
