import type { ContactInput } from '@sanctuary/shared';
import { EmailNotSentError } from '../errors/app-error.js';
import type { EmailService } from '../services/email/email.service.js';
import { contactMessageEmail } from '../services/email/templates/contact-message.js';

// CU-06: el mensaje va por email al buzón del santuario y no se guarda (TECH_SPEC §11.2).
export function createContactService({
  email,
  sanctuaryEmail,
  logEmailError = () => {},
}: {
  email: EmailService;
  sanctuaryEmail: string;
  logEmailError?: (error: unknown) => void;
}) {
  async function send(datos: ContactInput): Promise<void> {
    try {
      await email.send({ to: sanctuaryEmail, replyTo: datos.email, ...contactMessageEmail(datos) });
    } catch (error) {
      // 3c: aquí el email es la operación principal, así que el fallo se comunica.
      logEmailError(error);
      throw new EmailNotSentError();
    }
  }
  return { send };
}

export type ContactService = ReturnType<typeof createContactService>;
