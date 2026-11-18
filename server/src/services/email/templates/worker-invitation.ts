import type { Language } from '@sanctuary/shared';
import { emailConEnlace } from './enlace-simple.js';
import type { EmailContent } from './layout.js';

// CU-36 paso 4: invitación para que el trabajador elija su contraseña.
export function workerInvitationEmail(datos: { firstName: string; url: string; language?: Language }): EmailContent {
  return emailConEnlace(
    {
      es: {
        subject: 'Tu cuenta en el panel del santuario',
        cuerpo:
          'Te hemos creado una cuenta en el panel de gestión del Santuario de Animales. Para empezar, elige tu contraseña aquí:',
        aviso: 'El enlace caduca en 24 horas. Si caduca, pide a un administrador que te envíe otro.',
        boton: 'Elegir mi contraseña',
      },
      ca: {
        subject: 'El teu compte al tauler del santuari',
        cuerpo:
          "T'hem creat un compte al tauler de gestió del Santuario de Animales. Per a començar, tria la teua contrasenya ací:",
        aviso: "L'enllaç caduca en 24 hores. Si caduca, demana a un administrador que te n'envie un altre.",
        boton: 'Triar la meua contrasenya',
      },
      en: {
        subject: 'Your account on the sanctuary panel',
        cuerpo:
          'We have created an account for you on the Santuario de Animales management panel. To get started, choose your password here:',
        aviso: 'The link expires in 24 hours. If it expires, ask an administrator to send you another one.',
        boton: 'Choose my password',
      },
    },
    datos,
  );
}
