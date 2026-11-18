import { isWorkerRole, type DonationData, type DonationResultDto, type SessionUser } from '@sanctuary/shared';
import type { Pool } from 'pg';
import { withTransaction } from '../db/transaction.js';
import type { Reloj } from '../dominio/reloj.js';
import * as donationModel from '../models/donation.model.js';
import * as notificationModel from '../models/notification.model.js';
import type { EmailService } from '../services/email/email.service.js';
import { donationThanksEmail } from '../services/email/templates/donation-thanks.js';
import type { PaymentGateway } from '../services/payment/payment.service.js';
import { avisos } from './textos-avisos.js';

export interface DonationServiceDeps {
  db: Pool;
  reloj: Reloj;
  payments: PaymentGateway;
  email: EmailService;
  logEmailError?: (error: unknown) => void;
}

// CU-05 Hacer una donación (RN-12): con o sin cuenta, sin importe mínimo.
export function createDonationService({ db, reloj, payments, email, logEmailError = () => {} }: DonationServiceDeps) {
  /**
   * Cobra con la pasarela simulada y guarda la donación con el resultado. Como en
   * las cuotas (CU-13), el registro se crea ya con el estado final del cobro.
   */
  async function donate(user: SessionUser | null, datos: DonationData): Promise<DonationResultDto> {
    // 8: un adoptante la vincula a su cuenta; un trabajador no (6a, RN-03).
    const adoptante = user && !isWorkerRole(user.role) ? user : null;
    const donorEmail = datos.donorEmail ?? adoptante?.email ?? null;
    const donorName = datos.donorName ?? (adoptante ? `${adoptante.firstName} ${adoptante.lastName}` : null);

    const resultado = await payments.charge({
      amount: datos.amount,
      description: 'Donación',
      simulatedOutcome: datos.simulatedOutcome,
    });
    const donacion = await withTransaction(db, async (client) => {
      const creada = await donationModel.create(client, {
        userId: adoptante?.id ?? null,
        donorName,
        donorEmail,
        amount: datos.amount,
        isAnonymous: datos.isAnonymous,
        message: datos.message ?? null,
        status: resultado.success ? 'completed' : 'failed',
        reference: resultado.reference,
        failureReason: resultado.success ? null : (resultado.failureReason ?? 'Pago rechazado'),
        paidAt: resultado.success ? reloj.ahora() : null,
      });
      if (resultado.success && adoptante) {
        await notificationModel.create(client, {
          userId: adoptante.id,
          type: 'donation_thanks',
          message: avisos.gracias(datos.amount),
          link: '/my-contributions',
        });
      }
      return creada;
    });

    // 7, 7a: el email con el recibo solo si hay email. Los de pagos se envían siempre (RN-19).
    if (donacion.status === 'completed' && donorEmail && donacion.paidAt) {
      try {
        await email.send({
          to: donorEmail,
          ...donationThanksEmail({
            donorName,
            amount: donacion.amount,
            paidAt: new Date(donacion.paidAt),
            reference: donacion.reference,
            language: adoptante?.preferredLanguage ?? datos.language,
          }),
        });
      } catch (error) {
        logEmailError(error);
      }
    }
    return donacion;
  }

  return { donate };
}

export type DonationService = ReturnType<typeof createDonationService>;
