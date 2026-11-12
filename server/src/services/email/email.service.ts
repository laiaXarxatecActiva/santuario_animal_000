import nodemailer from 'nodemailer';

// Servicio de email (TECH_SPEC §11.2). Quien lo usa decide qué hacer si falla
// el envío: nunca se deshace la operación principal.

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Transporte de envío: SMTP (nodemailer) o el buzón en memoria de las pruebas. */
export interface Mailer {
  sendMail(message: EmailMessage & { from: string }): Promise<unknown>;
}

export interface EmailService {
  send(message: EmailMessage): Promise<void>;
}

export function createEmailService({ mailer, from }: { mailer: Mailer; from: string }): EmailService {
  return {
    async send(message) {
      await mailer.sendMail({ from, ...message });
    },
  };
}

export interface SmtpConfig {
  host: string;
  port: number;
  user?: string;
  password?: string;
}

/** Transporte SMTP. En local apunta a Mailpit (localhost:1025). */
export function createSmtpMailer({ host, port, user, password }: SmtpConfig): Mailer {
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user ? { user, pass: password ?? '' } : undefined,
  });
}

export interface MemoryMailer extends Mailer {
  readonly outbox: (EmailMessage & { from: string })[];
  /** Si es `true`, el siguiente envío falla (para probar los fallos de envío). */
  failNext: boolean;
}

/** Buzón en memoria para las pruebas. */
export function createMemoryMailer(): MemoryMailer {
  const mailer: MemoryMailer = {
    outbox: [],
    failNext: false,
    async sendMail(message) {
      if (mailer.failNext) {
        mailer.failNext = false;
        throw new Error('Fallo simulado al enviar el email');
      }
      mailer.outbox.push({ ...message });
    },
  };
  return mailer;
}
