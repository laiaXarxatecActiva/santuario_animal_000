import { LANGUAGES, type Language } from '@sanctuary/shared';
import { describe, expect, it } from 'vitest';
import { accountExistsEmail } from '../../../src/services/email/templates/account-exists.js';
import { adoptionAdminChangeEmail } from '../../../src/services/email/templates/adoption-admin-change.js';
import { adoptionCancelledEmail } from '../../../src/services/email/templates/adoption-cancelled.js';
import { adoptionClosedEmail } from '../../../src/services/email/templates/adoption-closed.js';
import { adoptionWelcomeEmail } from '../../../src/services/email/templates/adoption-welcome.js';
import { donationRefundedEmail } from '../../../src/services/email/templates/donation-refunded.js';
import { donationThanksEmail } from '../../../src/services/email/templates/donation-thanks.js';
import type { EmailContent } from '../../../src/services/email/templates/layout.js';
import { monthlyDigestEmail } from '../../../src/services/email/templates/monthly-digest.js';
import { newUpdateEmail } from '../../../src/services/email/templates/new-update.js';
import { paymentCompletedEmail } from '../../../src/services/email/templates/payment-completed.js';
import { paymentFailedEmail } from '../../../src/services/email/templates/payment-failed.js';
import { paymentRefundedEmail } from '../../../src/services/email/templates/payment-refunded.js';
import { planChangedEmail } from '../../../src/services/email/templates/plan-changed.js';
import { resetPasswordEmail } from '../../../src/services/email/templates/reset-password.js';
import { verifyEmailEmail } from '../../../src/services/email/templates/verify-email.js';
import { workerInvitationEmail } from '../../../src/services/email/templates/worker-invitation.js';

const recibo = {
  firstName: 'Irene',
  animalName: 'Brisa',
  planName: 'Usual',
  amount: '5.00',
  periodStart: '2026-11-12',
  periodEnd: '2026-12-11',
  reference: 'CARD-1',
  url: 'http://localhost:5173/my-animals',
};
const url = 'http://localhost:5173/x';

/** Cada plantilla, en un idioma. */
const PLANTILLAS: Record<string, (language: Language) => EmailContent> = {
  'verify-email': (language) => verifyEmailEmail({ firstName: 'Irene', url, language }),
  'reset-password': (language) => resetPasswordEmail({ firstName: 'Irene', url, language }),
  'worker-invitation': (language) => workerInvitationEmail({ firstName: 'Irene', url, language }),
  'account-exists': (language) =>
    accountExistsEmail({ firstName: 'Irene', loginUrl: url, forgotPasswordUrl: url, language }),
  'adoption-welcome': (language) => adoptionWelcomeEmail({ ...recibo, language }),
  'payment-completed': (language) => paymentCompletedEmail({ ...recibo, language }),
  'payment-failed': (language) =>
    paymentFailedEmail({ firstName: 'Irene', animalName: 'Brisa', amount: '5.00', url, language }),
  'payment-refunded': (language) => paymentRefundedEmail({ ...recibo, online: true, language }),
  'plan-changed': (language) => planChangedEmail({ ...recibo, fromDate: '2026-12-12', language }),
  'adoption-cancelled': (language) =>
    adoptionCancelledEmail({
      firstName: 'Irene',
      animalName: 'Brisa',
      status: 'active',
      endDate: '2026-12-11',
      url,
      language,
    }),
  'adoption-closed': (language) =>
    adoptionClosedEmail({
      firstName: 'Irene',
      animalName: 'Brisa',
      reason: 'animal_deceased',
      message: 'Mensaje del santuario',
      catalogUrl: url,
      language,
    }),
  'adoption-admin-change': (language) =>
    adoptionAdminChangeEmail({ firstName: 'Irene', animalName: 'Brisa', action: 'pause', date: null, url, language }),
  'new-update': (language) =>
    newUpdateEmail({ firstName: 'Irene', animalName: 'Brisa', title: 'Título', excerpt: 'Extracto', url, language }),
  'monthly-digest': (language) =>
    monthlyDigestEmail({
      firstName: 'Irene',
      monthName: 'X',
      animals: [{ name: 'Brisa', updates: [{ title: 'Título', excerpt: 'Extracto', url }] }],
      settingsUrl: url,
      language,
    }),
  'donation-thanks': (language) =>
    donationThanksEmail({
      donorName: 'Irene',
      amount: '20.00',
      paidAt: new Date('2026-11-12T10:00:00Z'),
      reference: 'CARD-D1',
      language,
    }),
  'donation-refunded': (language) =>
    donationRefundedEmail({ donorName: 'Irene', amount: '20.00', reference: 'CARD-D1', online: true, language }),
};

describe('Fase 3 Emails en el idioma del destinatario', () => {
  it.each(Object.entries(PLANTILLAS))(
    '%s: un asunto y un texto distintos en cada idioma, y el HTML con su lang',
    (_n, plantilla) => {
      const emails = LANGUAGES.map((idioma) => plantilla(idioma));
      expect(new Set(emails.map((e) => e.subject)).size).toBe(3);
      expect(new Set(emails.map((e) => e.text)).size).toBe(3);
      LANGUAGES.forEach((idioma, i) => expect(emails[i]!.html).toContain(`<html lang="${idioma}">`));
      // El nombre del santuario es una marca y no se traduce.
      for (const e of emails) expect(e.text).toContain('Santuario de Animales');
    },
  );

  it('sin idioma, castellano', () => {
    expect(verifyEmailEmail({ firstName: 'Irene', url }).subject).toBe('Verifica tu email');
  });

  it('el saludo y los importes van en el idioma (sin aviso de pago simulado)', () => {
    const ca = adoptionWelcomeEmail({ ...recibo, language: 'ca' });
    expect(ca.subject).toBe('Ja adoptes Brisa!');
    expect(ca.text).toContain('Hola, Irene:');
    expect(ca.text).not.toContain('simulat');
    const en = adoptionWelcomeEmail({ ...recibo, language: 'en' });
    expect(en.text).toContain('Hello Irene,');
    expect(en.text).toContain('Amount: €5.00');
    expect(en.html).toContain('See my animals');
  });

  it('el mensaje de despedida del santuario va tal cual', () => {
    expect(PLANTILLAS['adoption-closed']!('en').text).toContain('Mensaje del santuario');
  });
});
