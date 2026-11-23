import type { PaymentMethod, PaymentStatus } from '../constants/status.js';

// CU-19: aportaciones del adoptante. Importes como string; `date` es el
// instante del cobro (o de la creación si no se cobró), en ISO 8601.

export interface ContributionPaymentDto {
  id: number;
  adoptionId: number;
  animal: { id: number; name: string };
  amount: string;
  periodStart: string;
  periodEnd: string;
  date: string;
  status: PaymentStatus;
  method: PaymentMethod;
  reference: string;
}

export interface ContributionDonationDto {
  id: number;
  amount: string;
  date: string;
  status: PaymentStatus;
  method: PaymentMethod;
  reference: string;
  isAnonymous: boolean;
}

export interface ContributionsResponse {
  payments: ContributionPaymentDto[];
  donations: ContributionDonationDto[];
  /** Solo lo cobrado (`completed`), sin filtrar por año. */
  totals: { allTime: string; years: { year: number; total: string }[] };
}

/** Recibo imprimible de una cuota o una donación cobrada o devuelta (CU-19 paso 5). */
export interface ReceiptDto {
  kind: 'payment' | 'donation';
  id: number;
  reference: string;
  amount: string;
  method: PaymentMethod;
  status: 'completed' | 'refunded';
  paidAt: string;
  refundedAt: string | null;
  /** Solo en las cuotas. */
  animalName: string | null;
  planName: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  payer: { fullName: string; email: string };
  /** CU-05: datos para el certificado de donación (si el donante lo pidió). */
  fiscal?: DonorTaxData | null;
}

/** CU-05: datos fiscales del donante para desgravar. */
export interface DonorTaxData {
  taxId: string;
  address: string;
  postalCode: string;
  province: string;
  country: string;
}
