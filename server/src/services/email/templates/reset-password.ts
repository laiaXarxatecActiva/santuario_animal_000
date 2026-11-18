import type { Language } from '@sanctuary/shared';
import { emailConEnlace } from './enlace-simple.js';
import type { EmailContent } from './layout.js';

// CU-10: enlace para elegir una contraseña nueva.
export function resetPasswordEmail(datos: { firstName: string; url: string; language?: Language }): EmailContent {
  return emailConEnlace(
    {
      es: {
        subject: 'Recupera tu contraseña',
        cuerpo: 'Hemos recibido una petición para cambiar la contraseña de tu cuenta. Elige una nueva aquí:',
        aviso: 'El enlace caduca en 1 hora. Si no lo has pedido tú, ignora este mensaje: tu contraseña no cambiará.',
        boton: 'Elegir una contraseña nueva',
      },
      ca: {
        subject: 'Recupera la teua contrasenya',
        cuerpo: 'Hem rebut una petició per a canviar la contrasenya del teu compte. Tria-ne una de nova ací:',
        aviso: "L'enllaç caduca en 1 hora. Si no l'has demanat tu, no en faces cas: la contrasenya no canviarà.",
        boton: 'Triar una contrasenya nova',
      },
      en: {
        subject: 'Reset your password',
        cuerpo: 'We have received a request to change the password of your account. Choose a new one here:',
        aviso:
          "The link expires in 1 hour. If you didn't request it, ignore this message: your password will not change.",
        boton: 'Choose a new password',
      },
    },
    datos,
  );
}
