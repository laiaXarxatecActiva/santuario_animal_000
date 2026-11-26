import type { AdoptionEndReason, HistoryEventType, PaymentMode } from '../constants/status.js';
import type { PageMeta } from './api.js';

// Historial de «Mis animales» (CU-15, TECH_SPEC §10.4).

export interface HistoryEventDto {
  /** Único en el historial («event-12»), para las listas de React. */
  id: string;
  type: HistoryEventType;
  /** Día del suceso en el santuario, `YYYY-MM-DD`. */
  date: string;
  animal: { id: number; name: string };
  /** `adopted`: plan elegido; cambios de plan: el nuevo (el que se mantiene, si se anula). */
  planName: string | null;
  /** Cambios de plan: el de antes. */
  previousPlanName: string | null;
  /** `payment_mode_changed`: la nueva forma de pago. */
  paymentMode: PaymentMode | null;
  /** `ended`: cómo y por qué se cerró. */
  endStatus: 'cancelled' | 'finished' | null;
  endReason: AdoptionEndReason | null;
}

export interface HistoryResponse {
  data: HistoryEventDto[];
  /** `since`: primer día que se muestra (hace un año). */
  meta: PageMeta & { since: string };
}
