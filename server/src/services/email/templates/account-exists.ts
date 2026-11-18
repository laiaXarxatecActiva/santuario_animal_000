import type { Language } from '@sanctuary/shared';
import { htmlConEnlace, type EmailContent } from './layout.js';
import { FIRMA, saludo } from './textos.js';

const TEXTOS = {
  es: {
    subject: 'Ya tienes una cuenta en el santuario',
    cuerpo:
      'Alguien ha intentado crear una cuenta en el Santuario de Animales con este email, pero ya tienes una. Puedes iniciar sesión con tu contraseña:',
    olvido: 'Si no la recuerdas, elige una nueva:',
    aviso: 'Si no has sido tú, ignora este mensaje: tu cuenta no ha cambiado.',
    entrar: 'Iniciar sesión',
    olvidada: 'He olvidado mi contraseña',
  },
  ca: {
    subject: 'Ja tens un compte al santuari',
    cuerpo:
      'Algú ha intentat crear un compte al Santuario de Animales amb aquest correu, però ja en tens un. Pots iniciar la sessió amb la teua contrasenya:',
    olvido: "Si no te'n recordes, tria'n una de nova:",
    aviso: 'Si no has sigut tu, no en faces cas: el teu compte no ha canviat.',
    entrar: 'Inicia la sessió',
    olvidada: 'He oblidat la contrasenya',
  },
  en: {
    subject: 'You already have an account at the sanctuary',
    cuerpo:
      'Someone tried to create an account at the Santuario de Animales with this email, but you already have one. You can sign in with your password:',
    olvido: "If you don't remember it, choose a new one:",
    aviso: "If this wasn't you, ignore this message: your account has not changed.",
    entrar: 'Sign in',
    olvidada: 'I forgot my password',
  },
} satisfies Record<Language, Record<string, string>>;

// CU-07 3a: alguien ha intentado registrarse con un email que ya tiene cuenta.
// La web responde lo mismo que con un email nuevo (no revela qué cuentas
// existen) y solo el dueño del buzón se entera, por este email.
export function accountExistsEmail({
  firstName,
  loginUrl,
  forgotPasswordUrl,
  language = 'es',
}: {
  firstName: string;
  loginUrl: string;
  forgotPasswordUrl: string;
  language?: Language;
}): EmailContent {
  const t = TEXTOS[language];
  const hola = saludo(language, firstName);
  return {
    subject: t.subject,
    text: [hola, '', t.cuerpo, loginUrl, '', t.olvido, forgotPasswordUrl, '', t.aviso, '', FIRMA].join('\n'),
    html: htmlConEnlace(
      [hola, t.cuerpo],
      { url: loginUrl, texto: t.entrar },
      [t.aviso],
      { url: forgotPasswordUrl, texto: t.olvidada },
      language,
    ),
  };
}
