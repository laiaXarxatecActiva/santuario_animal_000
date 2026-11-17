import { relojFijo, type Reloj } from '../../src/dominio/reloj.js';
import type { JobDeps } from '../../src/jobs/job.types.js';
import { createEmailService } from '../../src/services/email/email.service.js';
import type { PaymentGateway } from '../../src/services/payment/payment.service.js';
import { createSimulatedGateway } from '../../src/services/payment/simulated.gateway.js';
import { TEST_CLIENT_URL, type TestApp } from '../helpers/test-app.js';

/** Dependencias de las tareas para las pruebas: la BD de pruebas, el buzón en memoria y un día fijo. */
export function depsDePrueba(
  t: TestApp,
  opciones: { hoy?: string; payments?: PaymentGateway; errores?: unknown[] } = {},
): JobDeps {
  const reloj: Reloj = relojFijo(`${opciones.hoy ?? t.hoy}T03:00:00+01:00`);
  return {
    db: t.pool,
    reloj,
    payments: opciones.payments ?? createSimulatedGateway({ mode: 'always_succeed', reloj }),
    email: createEmailService({ mailer: t.mailer, from: 'Santuario <no-reply@santuario.test>' }),
    clientUrl: TEST_CLIENT_URL,
    logError: (error) => opciones.errores?.push(error),
  };
}
