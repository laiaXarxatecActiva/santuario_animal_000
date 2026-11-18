import type { AdoptionEndReason, Language } from '@sanctuary/shared';
import { abrir, escapeHtml, type EmailContent } from './layout.js';
import { FIRMA, idiomaDe, saludo } from './textos.js';

// CU-33 paso 6: la adopción se cierra por el fallecimiento (con el mensaje
// redactado por el santuario) o el traslado del animal.
export function adoptionClosedEmail(datos: {
  firstName: string;
  animalName: string;
  reason: Extract<AdoptionEndReason, 'animal_deceased' | 'animal_transferred'>;
  /** Mensaje redactado a mano (fallecimiento); se respeta el salto de línea. Va tal cual, sin traducir. */
  message: string | null;
  catalogUrl: string;
  language?: Language;
}): EmailContent {
  const idioma = idiomaDe(datos);
  const a = datos.animalName;
  const t = {
    es: {
      fallecido: `Lamentamos comunicarte que ${a} ha fallecido.`,
      trasladado: `${a} se ha trasladado a otro centro, donde seguirán cuidándolo.`,
      cierre: 'Tu adopción queda cerrada y no se te volverá a cobrar ninguna cuota.',
      oferta: 'Si quieres, puedes seguir ayudando con otro de los animales del santuario.',
      asuntoFallecido: `Despedimos a ${a}`,
      asuntoTraslado: `${a} se traslada a otro centro`,
      boton: 'Ver los animales',
    },
    ca: {
      fallecido: `Lamentem comunicar-te que ${a} ha mort.`,
      trasladado: `${a} s'ha traslladat a un altre centre, on continuaran cuidant-lo.`,
      cierre: "La teua adopció queda tancada i no se't tornarà a cobrar cap quota.",
      oferta: 'Si vols, pots continuar ajudant amb un altre dels animals del santuari.',
      asuntoFallecido: `Ens acomiadem de ${a}`,
      asuntoTraslado: `${a} es trasllada a un altre centre`,
      boton: 'Veure els animals',
    },
    en: {
      fallecido: `We are sorry to tell you that ${a} has passed away.`,
      trasladado: `${a} has moved to another centre, where they will keep being cared for.`,
      cierre: 'Your adoption is now closed and you will not be charged any more fees.',
      oferta: 'If you like, you can keep helping with another of the sanctuary animals.',
      asuntoFallecido: `Saying goodbye to ${a}`,
      asuntoTraslado: `${a} is moving to another centre`,
      boton: 'See the animals',
    },
  }[idioma];
  const fallecido = datos.reason === 'animal_deceased';
  const mensaje = fallecido && datos.message ? datos.message : null;
  const parrafos = [
    saludo(idioma, datos.firstName),
    fallecido ? t.fallecido : t.trasladado,
    ...(mensaje ? [mensaje] : []),
    t.cierre,
    t.oferta,
  ];
  const p = (texto: string) => `<p>${escapeHtml(texto).replaceAll('\n', '<br>')}</p>`;
  return {
    subject: fallecido ? t.asuntoFallecido : t.asuntoTraslado,
    text: [...parrafos.flatMap((x) => [x, '']), datos.catalogUrl, '', FIRMA].join('\n'),
    html: [
      abrir(idioma),
      ...parrafos.map(p),
      `<p><a href="${escapeHtml(datos.catalogUrl)}" style="display: inline-block; padding: 10px 20px; border-radius: 999px; background: #A9532F; color: #FFFDF9; text-decoration: none;">${t.boton}</a></p>`,
      `<p>${FIRMA}</p>`,
      '</body></html>',
    ].join('\n'),
  };
}
