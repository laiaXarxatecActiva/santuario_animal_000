import type { Language } from '@sanctuary/shared';
import { htmlConEnlace, type EmailContent } from './layout.js';
import { FIRMA, saludo } from './textos.js';

export interface TextosEnlace {
  subject: string;
  cuerpo: string;
  aviso: string;
  boton: string;
}

/** Email con saludo, un párrafo, el enlace y un aviso (verificación, recuperación, invitación). */
export function emailConEnlace(
  textos: Record<Language, TextosEnlace>,
  { firstName, url, language = 'es' }: { firstName: string; url: string; language?: Language },
): EmailContent {
  const t = textos[language];
  const hola = saludo(language, firstName);
  return {
    subject: t.subject,
    text: [hola, '', t.cuerpo, url, '', t.aviso, '', FIRMA].join('\n'),
    html: htmlConEnlace([hola, t.cuerpo], { url, texto: t.boton }, [t.aviso], undefined, language),
  };
}
