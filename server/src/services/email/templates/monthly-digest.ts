import { escapeHtml, type EmailContent } from './layout.js';

export interface ResumenAnimal {
  name: string;
  updates: { title: string; excerpt: string; url: string }[];
}

// CU-46: resumen mensual de las actualizaciones, agrupadas por animal.
export function monthlyDigestEmail(datos: {
  firstName: string;
  /** Mes resumido, ya escrito («enero de 2030»). */
  monthName: string;
  animals: ResumenAnimal[];
  settingsUrl: string;
}): EmailContent {
  const saludo = `Hola, ${datos.firstName}:`;
  const intro = `Estas son las novedades de ${datos.monthName} de los animales que apadrinas.`;
  const pie = `Recibes este resumen porque lo elegiste en tu perfil. Puedes cambiarlo en ${datos.settingsUrl}`;
  const texto = [
    saludo,
    '',
    intro,
    '',
    ...datos.animals.flatMap((a) => [
      `${a.name}:`,
      ...a.updates.flatMap((u) => [`- ${u.title}`, `  ${u.excerpt}`, `  ${u.url}`]),
      '',
    ]),
    pie,
    '',
    'Santuario de Animales',
  ];
  const e = escapeHtml;
  const html = [
    '<!doctype html><html lang="es"><body style="font-family: sans-serif; line-height: 1.5; color: #3B2F26;">',
    `<p>${e(saludo)}</p>`,
    `<p>${e(intro)}</p>`,
    ...datos.animals.flatMap((a) => [
      `<h2 style="font-size: 18px;">${e(a.name)}</h2>`,
      '<ul>',
      ...a.updates.map(
        (u) => `<li><a href="${e(u.url)}" style="color: #A9532F;">${e(u.title)}</a><br>${e(u.excerpt)}</li>`,
      ),
      '</ul>',
    ]),
    `<p>Recibes este resumen porque lo elegiste en tu perfil. <a href="${e(datos.settingsUrl)}" style="color: #A9532F;">Cambiar las preferencias</a></p>`,
    '<p>Santuario de Animales</p>',
    '</body></html>',
  ];
  return { subject: `Novedades de ${datos.monthName}`, text: texto.join('\n'), html: html.join('\n') };
}
