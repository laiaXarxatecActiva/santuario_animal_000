import { describe, expect, it } from 'vitest';
import { createEmailService, createMemoryMailer } from '../../../src/services/email/email.service.js';

describe('servicio de email', () => {
  it('envía el mensaje con el remitente configurado', async () => {
    const mailer = createMemoryMailer();
    const email = createEmailService({ mailer, from: 'Santuario <no-reply@santuario.test>' });
    await email.send({ to: 'ana@correo.test', subject: 'Hola', html: '<p>Hola</p>', text: 'Hola' });
    expect(mailer.outbox).toEqual([
      {
        from: 'Santuario <no-reply@santuario.test>',
        to: 'ana@correo.test',
        subject: 'Hola',
        html: '<p>Hola</p>',
        text: 'Hola',
      },
    ]);
  });

  it('el buzón en memoria puede simular un fallo de envío', async () => {
    const mailer = createMemoryMailer();
    mailer.failNext = true;
    const email = createEmailService({ mailer, from: 'x@santuario.test' });
    await expect(email.send({ to: 'a@b.test', subject: 's', html: 'h', text: 't' })).rejects.toThrow('Fallo simulado');
    expect(mailer.outbox).toEqual([]);
    await email.send({ to: 'a@b.test', subject: 's', html: 'h', text: 't' });
    expect(mailer.outbox).toHaveLength(1);
  });
});
