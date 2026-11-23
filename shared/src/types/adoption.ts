import type { AdoptionEndReason, AdoptionStatus, PaymentMode, PaymentStatus } from '../constants/status.js';
import type { PhotoDto } from './public.js';

// Área del adoptante (TECH_SPEC §10.4). Fechas `DATE` como `YYYY-MM-DD`,
// instantes en ISO 8601 e importes como string.

export interface PlanSummaryDto {
  id: number;
  name: string;
  monthlyAmount: string;
}

export interface AdoptionDto {
  id: number;
  status: AdoptionStatus;
  animal: { id: number; name: string; species: string; coverPhoto: PhotoDto | null };
  plan: PlanSummaryDto;
  /** Cambio de plan programado para la próxima cuota (CU-20). */
  nextPlan: PlanSummaryDto | null;
  startDate: string | null;
  /** Último día cubierto (baja solicitada) o fecha de cierre. */
  endDate: string | null;
  nextBillingDate: string | null;
  /** El adoptante pidió la baja: sigue activa hasta `endDate` (RN-10). */
  cancelRequested: boolean;
  endReason: AdoptionEndReason | null;
  /** Solo en las activas: última actualización del animal + 14 días (RN-14). */
  nextUpdateExpected: string | null;
  createdAt: string;
  /**
   * Se puede pagar ahora: pendiente de 7 días o menos, pausada (CU-14) o, con
   * pago manual, desde 7 días antes de la cuota (CU-49).
   */
  canPay: boolean;
  /** CU-49: cobro automático cada mes o pago manual de cada cuota. */
  paymentMode: PaymentMode;
  /** CU-50: con pago manual y la cuota a pagar, último día para pagarla sin que se pause. */
  paymentDeadline: string | null;
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
