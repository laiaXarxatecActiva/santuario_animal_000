import type { DonationResultDto, PaymentMethod } from '@sanctuary/shared';
import type { Queryable } from '../db/pool.js';

// CU-05: donaciones. Nunca se borran; un reintento crea otra.

interface DonationRow {
  id: number;
  status: 'completed' | 'failed';
  amount: string;
  method: PaymentMethod;
  payment_reference: string;
  paid_at: Date | null;
  failure_reason: string | null;
  donor_name: string | null;
  donor_email: string | null;
  is_anonymous: boolean;
}

export function mapRow(row: DonationRow): DonationResultDto {
  return {
    id: row.id,
    status: row.status,
    amount: row.amount,
    method: row.method,
    reference: row.payment_reference,
    paidAt: row.paid_at?.toISOString() ?? null,
    failureReason: row.failure_reason,
    donorName: row.donor_name,
    donorEmail: row.donor_email,
    isAnonymous: row.is_anonymous,
  };
}

export interface NewDonation {
  userId: number | null;
  donorName: string | null;
  donorEmail: string | null;
  amount: string;
  isAnonymous: boolean;
  message: string | null;
  status: 'completed' | 'failed';
  reference: string;
  failureReason: string | null;
  paidAt: Date | null;
}

/** Donación de la pasarela simulada, con el resultado del cobro. */
export async function create(db: Queryable, d: NewDonation): Promise<DonationResultDto> {
  const { rows } = await db.query<DonationRow>(
    `INSERT INTO donations (user_id, donor_name, donor_email, amount, is_anonymous, message,
                            method, status, payment_reference, failure_reason, paid_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'simulated', $7, $8, $9, $10)
     RETURNING id, status, amount, method, payment_reference, paid_at, failure_reason,
               donor_name, donor_email, is_anonymous`,
    [
      d.userId,
      d.donorName,
      d.donorEmail,
      d.amount,
      d.isAnonymous,
      d.message,
      d.status,
      d.reference,
      d.failureReason,
      d.paidAt,
    ],
  );
  return mapRow(rows[0] as DonationRow);
}

/** CU-25 4.3: las donaciones del usuario se quedan sin nombre ni email; los importes se conservan. */
export async function clearDonorData(db: Queryable, userId: number): Promise<void> {
  await db.query('UPDATE donations SET donor_name = NULL, donor_email = NULL WHERE user_id = $1', [userId]);
}
