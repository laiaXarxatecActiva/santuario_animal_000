// Utilidades comunes de las plantillas de email.

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

const ENTIDADES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapa los datos del usuario antes de meterlos en el HTML. */
export function escapeHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ENTIDADES[c] ?? c);
}

// Colores del modo claro (DESIGN_SYSTEM §2.1): --color-text, --color-primary y --color-on-primary.
/** HTML sencillo con un párrafo por línea y un botón con el enlace. */
export function htmlConEnlace(
  parrafos: string[],
  enlace: { url: string; texto: string },
  despues: string[] = [],
): string {
  const p = (texto: string) => `<p>${escapeHtml(texto)}</p>`;
  return [
    '<!doctype html><html lang="es"><body style="font-family: sans-serif; line-height: 1.5; color: #3B2F26;">',
    ...parrafos.map(p),
    `<p><a href="${escapeHtml(enlace.url)}" style="display: inline-block; padding: 10px 20px; border-radius: 999px; background: #A9532F; color: #FFFDF9; text-decoration: none;">${escapeHtml(enlace.texto)}</a></p>`,
    ...despues.map(p),
    '<p>Santuario de Animales</p>',
    '</body></html>',
  ].join('\n');
}
