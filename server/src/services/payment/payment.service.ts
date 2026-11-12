import type { SimulatedOutcome } from '@sanctuary/shared';

// Pasarela de pago (TECH_SPEC §11.1). El resto del código solo conoce esta
// interfaz, para poder cambiar la simulación por una pasarela real.

export interface ChargeRequest {
  /** Importe como string ("5.00"), nunca como float. */
  amount: string;
  /** Concepto: "Cuota Usual - Rufo - 2026-11". */
  description: string;
  simulatedOutcome?: SimulatedOutcome;
}

export interface ChargeResult {
  success: boolean;
  reference: string;
  failureReason?: string;
}

export interface PaymentGateway {
  charge(request: ChargeRequest): Promise<ChargeResult>;
  refund(reference: string): Promise<{ success: boolean }>;
}
