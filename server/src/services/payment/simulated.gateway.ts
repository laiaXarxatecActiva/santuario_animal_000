import { randomBytes } from 'node:crypto';
import type { Reloj } from '../../dominio/reloj.js';
import type { PaymentGateway } from './payment.service.js';

export const PAYMENT_SIMULATION_MODES = ['always_succeed', 'always_fail', 'random'] as const;
export type PaymentSimulationMode = (typeof PAYMENT_SIMULATION_MODES)[number];

export interface SimulatedGatewayOptions {
  mode: PaymentSimulationMode;
  /** Probabilidad de fallo en modo `random` (de 0 a 1). */
  failureRate?: number;
  reloj: Reloj;
  /** Sustituye a Math.random en las pruebas. */
  random?: () => number;
}

const MOTIVO_FALLO = 'Pago rechazado por la pasarela simulada.';

/**
 * Pasarela simulada: no mueve dinero ni recibe datos de tarjeta (RN-13). El
 * resultado lo decide `simulatedOutcome` o, si no llega, el modo configurado.
 */
export function createSimulatedGateway({
  mode,
  failureRate = 0.2,
  reloj,
  random = Math.random,
}: SimulatedGatewayOptions): PaymentGateway {
  const referencia = () => `SIM-${reloj.hoy().replaceAll('-', '')}-${randomBytes(5).toString('hex').toUpperCase()}`;

  return {
    async charge({ simulatedOutcome }) {
      const success =
        simulatedOutcome !== undefined
          ? simulatedOutcome === 'success'
          : mode === 'always_succeed' || (mode === 'random' && random() >= failureRate);
      return success
        ? { success, reference: referencia() }
        : { success, reference: referencia(), failureReason: MOTIVO_FALLO };
    },
    async refund() {
      return { success: true };
    },
  };
}
