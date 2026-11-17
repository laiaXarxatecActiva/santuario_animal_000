import { htmlConEnlace, type EmailContent } from './layout.js';

// CU-07 3a: alguien ha intentado registrarse con un email que ya tiene cuenta.
// La web responde lo mismo que con un email nuevo (no revela qué cuentas
// existen) y solo el dueño del buzón se entera, por este email.
export function accountExistsEmail({
  firstName,
  loginUrl,
  forgotPasswordUrl,
}: {
  firstName: string;
  loginUrl: string;
  forgotPasswordUrl: string;
}): EmailContent {
  const saludo = `Hola, ${firstName}:`;
  const cuerpo =
    'Alguien ha intentado crear una cuenta en el Santuario de Animales con este email, pero ya tienes una. Puedes iniciar sesión con tu contraseña:';
  const olvido = 'Si no la recuerdas, elige una nueva:';
  const aviso = 'Si no has sido tú, ignora este mensaje: tu cuenta no ha cambiado.';
  return {
    subject: 'Ya tienes una cuenta en el santuario',
    text: [saludo, '', cuerpo, loginUrl, '', olvido, forgotPasswordUrl, '', aviso, '', 'Santuario de Animales'].join(
      '\n',
    ),
    html: htmlConEnlace([saludo, cuerpo], { url: loginUrl, texto: 'Iniciar sesión' }, [aviso], {
      url: forgotPasswordUrl,
      texto: 'He olvidado mi contraseña',
    }),
  };
}
