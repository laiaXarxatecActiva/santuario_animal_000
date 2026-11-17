import type { ContributionsQuery, ContributionsResponse, ReceiptDto } from '@sanctuary/shared';
import type { Pool } from 'pg';
import { tieneRecibo } from '../dominio/adopcion.js';
import { NotFoundError, ReceiptNotAvailableError } from '../errors/app-error.js';
import * as contributionModel from '../models/contribution.model.js';
import * as userModel from '../models/user.model.js';

// CU-19: «Mis aportaciones» y recibos (página HTML imprimible en la Fase 2).
export function createContributionService({ db }: { db: Pool }) {
  async function list(userId: number, { year }: ContributionsQuery): Promise<ContributionsResponse> {
    const [payments, donations, totals] = await Promise.all([
      contributionModel.listPayments(db, userId, year),
      contributionModel.listDonations(db, userId, year),
      contributionModel.totals(db, userId),
    ]);
    return { payments, donations, totals };
  }

  async function recibo(
    userId: number,
    kind: ReceiptDto['kind'],
    registro: contributionModel.ReceiptRecord | null,
  ): Promise<ReceiptDto> {
    if (!registro) throw new NotFoundError();
    if (!tieneRecibo(registro.status) || !registro.paidAt) throw new ReceiptNotAvailableError();
    const user = await userModel.findById(db, userId);
    if (!user) throw new NotFoundError();
    return {
      kind,
      id: registro.id,
      reference: registro.reference,
      amount: registro.amount,
      method: registro.method,
      status: registro.status,
      paidAt: registro.paidAt.toISOString(),
      refundedAt: registro.refundedAt?.toISOString() ?? null,
      animalName: registro.animalName,
      planName: registro.planName,
      periodStart: registro.periodStart,
      periodEnd: registro.periodEnd,
      payer: { fullName: `${user.firstName} ${user.lastName}`, email: user.email },
    };
  }

  const paymentReceipt = async (userId: number, id: number) =>
    recibo(userId, 'payment', await contributionModel.findOwnPaymentReceipt(db, userId, id));
  const donationReceipt = async (userId: number, id: number) =>
    recibo(userId, 'donation', await contributionModel.findOwnDonationReceipt(db, userId, id));

  return { list, paymentReceipt, donationReceipt };
}

export type ContributionService = ReturnType<typeof createContributionService>;
