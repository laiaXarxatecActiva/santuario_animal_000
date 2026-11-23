import {
  isWorkerRole,
  type DonationData,
  type DonationResultDto,
  type ReceiptDto,
  type SessionUser,
} from '@sanctuary/shared';
import type { Pool } from 'pg';
import { withTransaction } from '../db/transaction.js';
import { tieneRecibo } from '../dominio/adopcion.js';
import type { Reloj } from '../dominio/reloj.js';
import { NotFoundError } from '../errors/app-error.js';
import * as donationModel from '../models/donation.model.js';
import * as notificationModel from '../models/notification.model.js';
import type { EmailService } from '../services/email/email.service.js';
import { donationThanksEmail } from '../services/email/templates/donation-thanks.js';
import type { PaymentGateway } from '../services/payment/payment.service.js';
import { firmaValida, firmar } from '../utils/tokens.js';
import { avisos } from './textos-avisos.js';

export interface DonationServiceDeps {
  db: Pool;
  reloj: Reloj;
  payments: PaymentGateway;
  email: EmailService;
  /** Firma los enlaces al recibo (SESSION_SECRET). */
  receiptSecret: string;
  /** Para el enlace al recibo del email. */
  clientUrl: string;
  logEmailError?: (error: unknown) => void;
}

/** Texto que se firma para el enlace al recibo de una donación. */
const textoRecibo = (id: number) => `donation-receipt:${id}`;

// CU-05 Hacer una donación (RN-12): con o sin cuenta, sin importe mínimo.
export function createDonationService({
  db,
  reloj,
  payments,
  email,
  receiptSecret,
  clientUrl,
  logEmailError = () => {},
}: DonationServiceDeps) {
  /**
   * Cobra con la pasarela simulada y guarda la donación con el resultado. Como en
   * las cuotas (CU-13), el registro se crea ya con el estado final del cobro.
   */
  async function donate(user: SessionUser | null, datos: DonationData): Promise<DonationResultDto> {
    // 8: un adoptante la vincula a su cuenta; un trabajador no (6a, RN-03).
    const adoptante = user && !isWorkerRole(user.role) ? user : null;
    const fiscal =
      datos.taxCertificate &&
      datos.donorTaxId &&
      datos.donorAddress &&
      datos.donorPostalCode &&
      datos.donorProvince &&
      datos.donorCountry
        ? {
            taxId: datos.donorTaxId,
            address: datos.donorAddress,
            postalCode: datos.donorPostalCode,
            province: datos.donorProvince,
            country: datos.donorCountry,
          }
        : null;

    const resultado = await payments.charge({
      amount: datos.amount,
      description: 'Donación',
      simulatedOutcome: datos.simulatedOutcome,
    });
    const creada = await withTransaction(db, async (client) => {
      const nueva = await donationModel.create(client, {
        userId: adoptante?.id ?? null,
        donorName: datos.donorName,
        donorSurname: datos.donorSurname,
        donorEmail: datos.donorEmail,
        donorPhone: datos.donorPhone,
        fiscal,
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
      return nueva;
    });
    const donacion: DonationResultDto = { ...creada, receiptToken: firmar(receiptSecret, textoRecibo(creada.id)) };

    // 7: el email con el recibo. Los de pagos se envían siempre (RN-19).
    if (donacion.status === 'completed' && donacion.paidAt) {
      const idioma = adoptante?.preferredLanguage ?? datos.language ?? 'es';
      try {
        await email.send({
          to: datos.donorEmail,
          ...donationThanksEmail({
            donorName: datos.donorName,
            amount: donacion.amount,
            paidAt: new Date(donacion.paidAt),
            reference: donacion.reference,
            language: idioma,
            receiptUrl: `${clientUrl}/api/donations/${donacion.id}/receipt.pdf?token=${donacion.receiptToken}&lang=${idioma}`,
          }),
        });
      } catch (error) {
        logEmailError(error);
      }
    }
    return donacion;
  }

  /**
   * CU-05: recibo de una donación sin cuenta, con la firma del enlace. Una firma
   * que no vale, o una donación sin recibo (fallida), responden 404.
   */
  async function publicReceipt(id: number, token: string | undefined): Promise<ReceiptDto> {
    if (!token || !firmaValida(receiptSecret, textoRecibo(id), token)) throw new NotFoundError();
    const registro = await donationModel.findReceiptById(db, id);
    if (!registro || !tieneRecibo(registro.status) || !registro.paidAt) throw new NotFoundError();
    return {
      kind: 'donation',
      id: registro.id,
      reference: registro.reference,
      amount: registro.amount,
      method: registro.method,
      status: registro.status,
      paidAt: registro.paidAt.toISOString(),
      refundedAt: registro.refundedAt?.toISOString() ?? null,
      animalName: null,
      planName: null,
      periodStart: null,
      periodEnd: null,
      payer: {
        fullName: [registro.donorName, registro.donorSurname].filter(Boolean).join(' '),
        email: registro.donorEmail ?? '',
      },
      fiscal: registro.fiscal,
    };
  }

  return { donate, publicReceipt };
}

export type DonationService = ReturnType<typeof createDonationService>;
