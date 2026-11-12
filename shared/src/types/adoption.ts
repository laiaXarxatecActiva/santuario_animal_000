import type { AdoptionStatus, PaymentStatus } from '../constants/status.js';

// Área del adoptante (TECH_SPEC §10.4). Fechas `DATE` como `YYYY-MM-DD`,
// instantes en ISO 8601 e importes como string.

export interface AdoptionDto {
  id: number;
  status: AdoptionStatus;
  animal: { id: number; name: string };
  plan: { id: number; name: string; monthlyAmount: string };
  startDate: string | null;
  nextBillingDate: string | null;
  createdAt: string;
  /** Se puede pagar ahora: pendiente de 7 días o menos, o pausada (CU-14). */
  canPay: boolean;
}

export interface PaymentDto {
  id: number;
  status: PaymentStatus;
  amount: string;
  periodStart: string;
  periodEnd: string;
  failureReason: string | null;
}

export interface PayAdoptionResponse {
  adoption: AdoptionDto;
  payment: PaymentDto;
}
