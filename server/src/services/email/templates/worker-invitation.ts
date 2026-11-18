import { htmlConEnlace, type EmailContent } from './layout.js';

// CU-36 paso 4: invitación para que el trabajador elija su contraseña.
export function workerInvitationEmail({ firstName, url }: { firstName: string; url: string }): EmailContent {
  const saludo = `Hola, ${firstName}:`;
  const cuerpo =
    'Te hemos creado una cuenta en el panel de gestión del Santuario de Animales. Para empezar, elige tu contraseña aquí:';
  const aviso = 'El enlace caduca en 24 horas. Si caduca, pide a un administrador que te envíe otro.';
  return {
    subject: 'Tu cuenta en el panel del santuario',
    text: [saludo, '', cuerpo, url, '', aviso, '', 'Santuario de Animales'].join('\n'),
    html: htmlConEnlace([saludo, cuerpo], { url, texto: 'Elegir mi contraseña' }, [aviso]),
  };
}
