import type { Language } from '@sanctuary/shared';
import { emailConEnlace } from './enlace-simple.js';
import type { EmailContent } from './layout.js';

// CU-07 y CU-08: verificación del email (registro y reenvío).
export function verifyEmailEmail(datos: { firstName: string; url: string; language?: Language }): EmailContent {
  return emailConEnlace(
    {
      es: {
        subject: 'Verifica tu email',
        cuerpo: 'Gracias por registrarte en el Santuario de Animales. Para poder adoptar, confirma tu email:',
        aviso: 'El enlace caduca en 24 horas. Si no te has registrado tú, puedes ignorar este mensaje.',
        boton: 'Verificar mi email',
      },
      ca: {
        subject: 'Verifica el teu correu',
        cuerpo: 'Gràcies per registrar-te al Santuario de Animales. Per a poder adoptar, confirma el teu correu:',
        aviso: "L'enllaç caduca en 24 hores. Si no t'has registrat tu, no en faces cas.",
        boton: 'Verificar el meu correu',
      },
      en: {
        subject: 'Verify your email',
        cuerpo:
          'Thank you for signing up at the Santuario de Animales. To be able to adopt, please confirm your email:',
        aviso: "The link expires in 24 hours. If you didn't sign up, you can ignore this message.",
        boton: 'Verify my email',
      },
    },
    datos,
  );
}
