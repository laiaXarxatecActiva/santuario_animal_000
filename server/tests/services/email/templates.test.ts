import { describe, expect, it } from 'vitest';
import { adoptionWelcomeEmail } from '../../../src/services/email/templates/adoption-welcome.js';
import { paymentCompletedEmail } from '../../../src/services/email/templates/payment-completed.js';
import { resetPasswordEmail } from '../../../src/services/email/templates/reset-password.js';
import { verifyEmailEmail } from '../../../src/services/email/templates/verify-email.js';

describe('plantillas de email', () => {
  it('CU-07 verify-email incluye el enlace en HTML y en texto', () => {
    const url = 'http://localhost:5173/verify-email?token=abc';
    const email = verifyEmailEmail({ firstName: 'Ana', url });
    expect(email.subject).toBe('Verifica tu email');
    expect(email.text).toContain('Hola, Ana');
    expect(email.text).toContain(url);
    expect(email.html).toContain(`href="${url}"`);
    expect(email.text).toContain('24 horas');
  });

  it('CU-10 reset-password caduca en 1 hora', () => {
    const email = resetPasswordEmail({ firstName: 'Ana', url: 'http://x/reset-password?token=t' });
    expect(email.subject).toBe('Recupera tu contraseña');
    expect(email.text).toContain('1 hora');
    expect(email.html).toContain('href="http://x/reset-password?token=t"');
  });

  it('escapa el HTML de los datos del usuario', () => {
    const email = verifyEmailEmail({ firstName: '<b>Ana</b> & co', url: 'http://x/?a=1&b=2' });
    expect(email.html).toContain('&lt;b&gt;Ana&lt;/b&gt; &amp; co');
    expect(email.html).toContain('href="http://x/?a=1&amp;b=2"');
    expect(email.html).not.toContain('<b>Ana</b>');
  });
});

describe('plantillas de pagos (CU-13, CU-14)', () => {
  const recibo = {
    firstName: 'Irene',
    animalName: 'Brisa',
    planName: 'Usual',
    amount: '5.00',
    periodStart: '2026-11-12',
    periodEnd: '2026-12-11',
    reference: 'SIM-20261112-ABCDEF0123',
    url: 'http://localhost:5173/my-animals',
  };

  it('adoption-welcome incluye el recibo de la primera cuota', () => {
    const email = adoptionWelcomeEmail(recibo);
    expect(email.subject).toBe('¡Ya adoptas a Brisa!');
    for (const texto of ['Hola, Irene', 'Plan Usual', '5,00', '12/11/2026', '11/12/2026', 'SIM-20261112-ABCDEF0123']) {
      expect(email.text).toContain(texto);
      expect(email.html).toContain(texto);
    }
    expect(email.text).toContain('Pago simulado');
  });

  it('payment-completed confirma la cuota cobrada', () => {
    const email = paymentCompletedEmail(recibo);
    expect(email.subject).toBe('Cuota cobrada: Brisa');
    expect(email.text).toContain('SIM-20261112-ABCDEF0123');
    expect(email.html).toContain('href="http://localhost:5173/my-animals"');
  });
});
