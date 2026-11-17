import type { AdoptionEndReason } from '@sanctuary/shared';
import { escapeHtml, type EmailContent } from './layout.js';

// CU-33 paso 6: la adopción se cierra por el fallecimiento (con el mensaje
// redactado por el santuario) o el traslado del animal.
export function adoptionClosedEmail(datos: {
  firstName: string;
  animalName: string;
  reason: Extract<AdoptionEndReason, 'animal_deceased' | 'animal_transferred'>;
  /** Mensaje redactado a mano (fallecimiento); se respeta el salto de línea. */
  message: string | null;
  catalogUrl: string;
}): EmailContent {
  const fallecido = datos.reason === 'animal_deceased';
  const saludo = `Hola, ${datos.firstName}:`;
  const aviso = fallecido
    ? `Lamentamos comunicarte que ${datos.animalName} ha fallecido.`
    : `${datos.animalName} se ha trasladado a otro centro, donde seguirán cuidándolo.`;
  const cierre = 'Tu adopción queda cerrada y no se te volverá a cobrar ninguna cuota.';
  const oferta = 'Si quieres, puedes seguir ayudando con otro de los animales del santuario.';
  const mensaje = fallecido && datos.message ? datos.message : null;
  const parrafos = [saludo, aviso, ...(mensaje ? [mensaje] : []), cierre, oferta];
  const p = (texto: string) => `<p>${escapeHtml(texto).replaceAll('\n', '<br>')}</p>`;
  return {
    subject: fallecido ? `Despedimos a ${datos.animalName}` : `${datos.animalName} se traslada a otro centro`,
    text: [...parrafos.flatMap((x) => [x, '']), datos.catalogUrl, '', 'Santuario de Animales'].join('\n'),
    html: [
      '<!doctype html><html lang="es"><body style="font-family: sans-serif; line-height: 1.5; color: #3B2F26;">',
      ...parrafos.map(p),
      `<p><a href="${escapeHtml(datos.catalogUrl)}" style="display: inline-block; padding: 10px 20px; border-radius: 999px; background: #A9532F; color: #FFFDF9; text-decoration: none;">Ver los animales</a></p>`,
      '<p>Santuario de Animales</p>',
      '</body></html>',
    ].join('\n'),
  };
}
