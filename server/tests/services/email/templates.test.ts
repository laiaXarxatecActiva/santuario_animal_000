import { describe, expect, it } from 'vitest';
import { accountExistsEmail } from '../../../src/services/email/templates/account-exists.js';
import { adoptionCancelledEmail } from '../../../src/services/email/templates/adoption-cancelled.js';
import { contactMessageEmail } from '../../../src/services/email/templates/contact-message.js';
import { donationThanksEmail } from '../../../src/services/email/templates/donation-thanks.js';
import { adoptionWelcomeEmail } from '../../../src/services/email/templates/adoption-welcome.js';
import { paymentCompletedEmail } from '../../../src/services/email/templates/payment-completed.js';
import { planChangedEmail } from '../../../src/services/email/templates/plan-changed.js';
import { paymentFailedEmail } from '../../../src/services/email/templates/payment-failed.js';
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

  it('CU-07 3a account-exists enlaza a iniciar sesión y a recuperar la contraseña', () => {
    const email = accountExistsEmail({
      firstName: 'Lucía',
      loginUrl: 'http://x/login',
      forgotPasswordUrl: 'http://x/forgot-password',
    });
    expect(email.subject).toBe('Ya tienes una cuenta en el santuario');
    expect(email.text).toContain('Hola, Lucía:');
    expect(email.text).toContain('http://x/login');
    expect(email.text).toContain('http://x/forgot-password');
    expect(email.text).toContain('Si no has sido tú');
    expect(email.html).toContain('href="http://x/login"');
    expect(email.html).toContain('href="http://x/forgot-password"');
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

describe('CU-43 3a payment-failed', () => {
  it('avisa de la pausa y enlaza a la ficha para regularizar', () => {
    const url = 'http://localhost:5173/my-animals/2';
    const email = paymentFailedEmail({ firstName: 'Elena', animalName: 'Greta', amount: '5.00', url });
    expect(email.subject).toBe('No hemos podido cobrar la cuota de Greta');
    expect(email.text).toContain('Hola, Elena:');
    expect(email.text).toMatch(/5,00\s€/);
    expect(email.text).toContain('pausada');
    expect(email.text).toContain(url);
    expect(email.html).toContain(`href="${url}"`);
  });
});

describe('CU-20 plan-changed', () => {
  it('indica el nuevo plan, su importe y desde cuándo se aplica', () => {
    const email = planChangedEmail({
      firstName: 'Pablo',
      animalName: 'Rufo',
      planName: 'Usual',
      amount: '5.00',
      fromDate: '2026-12-05',
      url: 'http://localhost:5173/my-animals',
    });
    expect(email.subject).toBe('Cambio de plan programado: Rufo');
    for (const texto of ['Hola, Pablo:', 'Usual', '05/12/2026', 'http://localhost:5173/my-animals']) {
      expect(email.text).toContain(texto);
    }
    expect(email.text).toMatch(/5,00\s€/);
  });
});

describe('CU-21 adoption-cancelled', () => {
  const base = { firstName: 'Lucía', animalName: 'Carbón', url: 'http://localhost:5173/my-animals' };
  it('activa: sigue activa hasta el último día pagado', () => {
    const email = adoptionCancelledEmail({ ...base, status: 'active', endDate: '2026-12-04' });
    expect(email.subject).toBe('Baja confirmada: Carbón');
    expect(email.text).toContain('04/12/2026');
    expect(email.text).toContain('no se te volverá a cobrar');
  });
  it('pendiente o pausada: termina ya, sin cobros', () => {
    expect(adoptionCancelledEmail({ ...base, status: 'cancelled', endDate: '2026-11-17' }).text).toContain(
      'no se te ha cobrado nada',
    );
    expect(adoptionCancelledEmail({ ...base, status: 'finished', endDate: '2026-11-09' }).text).toContain(
      'no se cobrará',
    );
  });
});

describe('CU-05 donation-thanks', () => {
  it('agradece la donación e incluye el recibo', () => {
    const email = donationThanksEmail({
      donorName: 'Marta',
      amount: '12.50',
      paidAt: new Date('2026-11-17T10:00:00Z'),
      reference: 'SIM-20261117-ABC',
    });
    expect(email.subject).toBe('¡Gracias por tu donación!');
    expect(email.text).toContain('Hola, Marta:');
    expect(email.text).toMatch(/12,50\s€/);
    expect(email.text).toContain('17/11/2026');
    expect(email.text).toContain('SIM-20261117-ABC');
    expect(email.text).toContain('Pago simulado');
  });

  it('sin nombre saluda sin él', () => {
    const email = donationThanksEmail({ donorName: null, amount: '1.00', paidAt: new Date(), reference: 'R' });
    expect(email.text.startsWith('Hola:')).toBe(true);
  });
});

describe('CU-06 contact-message', () => {
  it('incluye los datos del visitante y escapa el HTML', () => {
    const email = contactMessageEmail({
      name: '<b>Ana</b>',
      email: 'ana@correo.test',
      subject: 'Visita',
      message: 'Línea 1\nLínea 2',
    });
    expect(email.subject).toBe('Contacto: Visita');
    expect(email.text).toContain('<b>Ana</b> <ana@correo.test>');
    expect(email.text).toContain('Línea 1\nLínea 2');
    expect(email.html).toContain('&lt;b&gt;Ana&lt;/b&gt;');
    expect(email.html).not.toContain('<b>Ana</b>');
  });
});
