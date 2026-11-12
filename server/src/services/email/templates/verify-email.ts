import { htmlConEnlace, type EmailContent } from './layout.js';

// CU-07 y CU-08: verificación del email (registro y reenvío).
export function verifyEmailEmail({ firstName, url }: { firstName: string; url: string }): EmailContent {
  const saludo = `Hola, ${firstName}:`;
  const cuerpo = 'Gracias por registrarte en el Santuario de Animales. Para poder adoptar, confirma tu email:';
  const aviso = 'El enlace caduca en 24 horas. Si no te has registrado tú, puedes ignorar este mensaje.';
  return {
    subject: 'Verifica tu email',
    text: [saludo, '', cuerpo, url, '', aviso, '', 'Santuario de Animales'].join('\n'),
    html: htmlConEnlace([saludo, cuerpo], { url, texto: 'Verificar mi email' }, [aviso]),
  };
}
