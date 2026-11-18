import type { Language } from '@sanctuary/shared';
import { abrir, escapeHtml, type EmailContent } from './layout.js';
import { FIRMA, idiomaDe, saludo } from './textos.js';

export interface ResumenAnimal {
  name: string;
  updates: { title: string; excerpt: string; url: string }[];
}

// CU-46: resumen mensual de las actualizaciones, agrupadas por animal.
export function monthlyDigestEmail(datos: {
  firstName: string;
  /** Mes resumido, ya escrito en el idioma del destinatario («enero de 2030»). */
  monthName: string;
  animals: ResumenAnimal[];
  settingsUrl: string;
  language?: Language;
}): EmailContent {
  const idioma = idiomaDe(datos);
  const mes = datos.monthName;
  const t = {
    es: {
      subject: `Novedades de ${mes}`,
      intro: `Estas son las novedades de ${mes} de los animales que apadrinas.`,
      motivo: 'Recibes este resumen porque lo elegiste en tu perfil.',
      cambiar: 'Puedes cambiarlo en',
      enlace: 'Cambiar las preferencias',
    },
    ca: {
      subject: `Novetats de ${mes}`,
      intro: `Estes són les novetats de ${mes} dels animals que apadrines.`,
      motivo: 'Reps aquest resum perquè el vas triar al teu perfil.',
      cambiar: 'Pots canviar-ho en',
      enlace: 'Canviar les preferències',
    },
    en: {
      subject: `News from ${mes}`,
      intro: `Here is the news from ${mes} about the animals you sponsor.`,
      motivo: 'You receive this summary because you chose it in your profile.',
      cambiar: 'You can change it at',
      enlace: 'Change your preferences',
    },
  }[idioma];
  const hola = saludo(idioma, datos.firstName);
  const texto = [
    hola,
    '',
    t.intro,
    '',
    ...datos.animals.flatMap((a) => [
      `${a.name}:`,
      ...a.updates.flatMap((u) => [`- ${u.title}`, `  ${u.excerpt}`, `  ${u.url}`]),
      '',
    ]),
    `${t.motivo} ${t.cambiar} ${datos.settingsUrl}`,
    '',
    FIRMA,
  ];
  const e = escapeHtml;
  const html = [
    abrir(idioma),
    `<p>${e(hola)}</p>`,
    `<p>${e(t.intro)}</p>`,
    ...datos.animals.flatMap((a) => [
      `<h2 style="font-size: 18px;">${e(a.name)}</h2>`,
      '<ul>',
      ...a.updates.map(
        (u) => `<li><a href="${e(u.url)}" style="color: #A9532F;">${e(u.title)}</a><br>${e(u.excerpt)}</li>`,
      ),
      '</ul>',
    ]),
    `<p>${e(t.motivo)} <a href="${e(datos.settingsUrl)}" style="color: #A9532F;">${e(t.enlace)}</a></p>`,
    `<p>${FIRMA}</p>`,
    '</body></html>',
  ];
  return { subject: t.subject, text: texto.join('\n'), html: html.join('\n') };
}
