import { htmlConEnlace, type EmailContent } from './layout.js';

// CU-10: enlace para elegir una contraseña nueva.
export function resetPasswordEmail({ firstName, url }: { firstName: string; url: string }): EmailContent {
  const saludo = `Hola, ${firstName}:`;
  const cuerpo = 'Hemos recibido una petición para cambiar la contraseña de tu cuenta. Elige una nueva aquí:';
  const aviso = 'El enlace caduca en 1 hora. Si no lo has pedido tú, ignora este mensaje: tu contraseña no cambiará.';
  return {
    subject: 'Recupera tu contraseña',
    text: [saludo, '', cuerpo, url, '', aviso, '', 'Santuario de Animales'].join('\n'),
    html: htmlConEnlace([saludo, cuerpo], { url, texto: 'Elegir una contraseña nueva' }, [aviso]),
  };
}
