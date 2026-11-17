import type { Config } from '../config/env.js';
import { createPool } from '../db/pool.js';
import { relojSistema } from '../dominio/reloj.js';
import { createEmailService, createSmtpMailer } from '../services/email/email.service.js';
import { createSimulatedGateway } from '../services/payment/simulated.gateway.js';
import type { JobDeps } from './job.types.js';

/** Dependencias reales (BD, SMTP, pasarela simulada) a partir de la configuración. */
export function createJobDeps(config: Config, logError?: JobDeps['logError']): JobDeps {
  const mailer = createSmtpMailer({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    user: config.SMTP_USER,
    password: config.SMTP_PASSWORD,
  });
  return {
    db: createPool(config.DATABASE_URL),
    reloj: relojSistema,
    email: createEmailService({ mailer, from: config.MAIL_FROM }),
    payments: createSimulatedGateway({
      mode: config.PAYMENT_SIMULATION_MODE,
      failureRate: config.PAYMENT_SIMULATION_FAILURE_RATE,
      reloj: relojSistema,
    }),
    clientUrl: config.CLIENT_URL,
    logError,
  };
}
