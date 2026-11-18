import type { Language } from '@sanctuary/shared';
import { htmlConEnlace, type EmailContent } from './layout.js';
import { FIRMA, idiomaDe, saludo } from './textos.js';

// CU-31 paso 4.2: nueva actualización de un animal apadrinado (si el adoptante la quiere por email).
// El título y el extracto los escribe el santuario y van tal cual.
export function newUpdateEmail(datos: {
  firstName: string;
  animalName: string;
  title: string;
  excerpt: string;
  url: string;
  language?: Language;
}): EmailContent {
  const idioma = idiomaDe(datos);
  const a = datos.animalName;
  const t = {
    es: {
      subject: `Nueva actualización de ${a}`,
      cuerpo: `Hay una nueva actualización de ${a}: «${datos.title}».`,
      boton: 'Leer la actualización',
    },
    ca: {
      subject: `Nova actualització de ${a}`,
      cuerpo: `Hi ha una nova actualització de ${a}: «${datos.title}».`,
      boton: "Llegir l'actualització",
    },
    en: {
      subject: `New update about ${a}`,
      cuerpo: `There is a new update about ${a}: "${datos.title}".`,
      boton: 'Read the update',
    },
  }[idioma];
  const hola = saludo(idioma, datos.firstName);
  return {
    subject: t.subject,
    text: [hola, '', t.cuerpo, '', datos.excerpt, '', datos.url, '', FIRMA].join('\n'),
    html: htmlConEnlace([hola, t.cuerpo, datos.excerpt], { url: datos.url, texto: t.boton }, [], undefined, idioma),
  };
}
