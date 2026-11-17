import type { Pool } from 'pg';
import type { Reloj } from '../dominio/reloj.js';
import type { EmailService } from '../services/email/email.service.js';
import type { PaymentGateway } from '../services/payment/payment.service.js';

/** Lo que necesitan las tareas programadas (TECH_SPEC §11.4). El día lo da el Reloj. */
export interface JobDeps {
  db: Pool;
  reloj: Reloj;
  payments: PaymentGateway;
  email: EmailService;
  /** URL del cliente, para los enlaces de los emails. */
  clientUrl: string;
  /** Registra los errores que no detienen la tarea (un email, una adopción concreta). */
  logError?: (error: unknown, contexto: string) => void;
}

/** Resumen de una ejecución: cuántos elementos se han procesado de cada tipo. */
export type JobResult = Record<string, number>;
