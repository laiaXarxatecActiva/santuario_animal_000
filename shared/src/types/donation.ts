import type { PaymentMethod } from '../constants/status.js';

/** CU-05: resultado de una donación, con lo necesario para el recibo en pantalla. */
export interface DonationResultDto {
  id: number;
  status: 'completed' | 'failed';
  amount: string;
  method: PaymentMethod;
  reference: string;
  /** ISO 8601; `null` si el pago falló. */
  paidAt: string | null;
  failureReason: string | null;
  donorName: string | null;
  donorEmail: string | null;
  isAnonymous: boolean;
}
