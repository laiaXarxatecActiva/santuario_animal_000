import { describe, expect, it } from 'vitest';
import { donationRefundedEmail } from '../src/services/email/templates/donation-refunded.js';

describe('CU-39 A2 Email de una donación devuelta', () => {
  const datos = { donorName: 'Ana', amount: '25.50', reference: 'TRF-20261118-ABC', online: false };

  it('saluda por el nombre e indica el importe y la referencia', () => {
    const email = donationRefundedEmail(datos);
    expect(email.subject).toBe('Te hemos devuelto tu donación');
    expect(email.text).toContain('Hola, Ana:');
    expect(email.text).toMatch(/Te hemos devuelto tu donación de 25,50\s€ \(referencia TRF-20261118-ABC\)\./);
  });

  it('explica cómo se devuelve según dónde se pagó', () => {
    expect(donationRefundedEmail(datos).text).toContain('nos pondremos en contacto contigo');
    expect(donationRefundedEmail({ ...datos, online: true }).text).toContain('por el mismo medio');
  });

  it('sin nombre, un saludo genérico', () => {
    expect(donationRefundedEmail({ ...datos, donorName: null }).text.startsWith('Hola:')).toBe(true);
  });
});
