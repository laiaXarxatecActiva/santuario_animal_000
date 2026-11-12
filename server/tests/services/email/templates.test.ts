import { describe, expect, it } from 'vitest';
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
