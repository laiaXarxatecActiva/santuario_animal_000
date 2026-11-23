import type { Language } from '@sanctuary/shared';
import { emailConEnlace } from './enlace-simple.js';
import type { EmailContent } from './layout.js';

// CU-51: un administrador pide que el trabajador cambie su contraseña.
export function adminPasswordResetEmail(datos: { firstName: string; url: string; language?: Language }): EmailContent {
  return emailConEnlace(
    {
      es: {
        subject: 'Cambia tu contraseña del santuario',
        cuerpo:
          'Un administrador del santuario ha pedido que cambies la contraseña de tu cuenta. Elige una nueva aquí:',
        aviso:
          'El enlace caduca en 30 minutos. Hasta que la cambies, tu contraseña actual sigue funcionando. Al cambiarla se cerrarán tus sesiones abiertas.',
        boton: 'Elegir una contraseña nueva',
      },
      ca: {
        subject: 'Canvia la teua contrasenya del santuari',
        cuerpo:
          'Un administrador del santuari ha demanat que canvies la contrasenya del teu compte. Tria-ne una de nova ací:',
        aviso:
          "L'enllaç caduca en 30 minuts. Fins que la canvies, la contrasenya actual continua funcionant. En canviar-la es tancaran les teues sessions obertes.",
        boton: 'Triar una contrasenya nova',
      },
      en: {
        subject: 'Change your sanctuary password',
        cuerpo:
          'A sanctuary administrator has asked you to change the password of your account. Choose a new one here:',
        aviso:
          'The link expires in 30 minutes. Until you change it, your current password still works. Changing it will close your open sessions.',
        boton: 'Choose a new password',
      },
    },
    datos,
  );
}
