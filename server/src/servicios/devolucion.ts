import type { Language } from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';
import { pasaPorPasarela, puedeDevolverse } from '../dominio/pagos-admin.js';
import { NotFoundError, PaymentNotRefundableError, RefundFailedError } from '../errors/app-error.js';
import * as notificationModel from '../models/notification.model.js';
import * as paymentModel from '../models/payment.model.js';
import { paymentRefundedEmail } from '../services/email/templates/payment-refunded.js';
import type { PaymentGateway } from '../services/payment/payment.service.js';
import { avisos } from './textos-avisos.js';

/**
 * CU-38 A1 (también al cancelar una adopción, CU-37 A3): devuelve un pago
 * dentro de la transacción de quien llama. Bloquea el pago, comprueba que está
 * cobrado y, si se hizo en la web, pide la devolución a la pasarela.
 */
export async function devolverPago(
  client: Queryable,
  gateway: PaymentGateway,
  paymentId: number,
  ahora: Date,
): Promise<paymentModel.PaymentToRefund> {
  const pago = await paymentModel.findForRefund(client, paymentId);
  if (!pago) throw new NotFoundError('Este pago no existe.');
  if (!puedeDevolverse(pago.status)) throw new PaymentNotRefundableError();
  if (pasaPorPasarela(pago.method) && !(await gateway.refund(pago.reference)).success) {
    throw new RefundFailedError();
  }
  await paymentModel.markRefunded(client, pago.id, ahora);
  return pago;
}

/** Aviso en la campana de una devolución (dentro de la transacción). */
export async function notificarDevolucion(client: Queryable, pago: paymentModel.AdminPayment): Promise<void> {
  await notificationModel.create(client, {
    userId: pago.adopter.id,
    type: 'system',
    message: avisos.cuotaDevuelta(pago.animal.name, pago.amount),
    link: '/my-contributions',
  });
}

/** Email de una devolución; `null` si la cuenta se eliminó (no hay a quién escribir). */
export function emailDevolucion(
  pago: paymentModel.AdminPayment,
  clientUrl: string,
  language: Language = 'es',
): { to: string; subject: string; text: string; html: string } | null {
  if (pago.adopter.email === '') return null;
  return {
    to: pago.adopter.email,
    ...paymentRefundedEmail({
      firstName: pago.adopter.firstName,
      animalName: pago.animal.name,
      amount: pago.amount,
      periodStart: pago.periodStart,
      periodEnd: pago.periodEnd,
      online: pasaPorPasarela(pago.method),
      url: new URL('/my-contributions', clientUrl).toString(),
      language,
    }),
  };
}
