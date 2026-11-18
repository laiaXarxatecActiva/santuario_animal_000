import { readFileSync } from 'node:fs';
import { RAIZ } from './entorno.js';

// Los textos de la interfaz se leen de locales/es.json, como hace la aplicación,
// para que las pruebas no se rompan al cambiar la redacción de un botón.

const es: unknown = JSON.parse(readFileSync(`${RAIZ}client/src/i18n/locales/es.json`, 'utf8'));

/**
 * Devuelve el texto de una clave («auth.login.submit»), con las variables
 * `{{nombre}}` sustituidas y sin las etiquetas de componentes («<0>…</0>»).
 */
export function t(clave: string, variables: Record<string, string> = {}): string {
  let valor: unknown = es;
  for (const parte of clave.split('.')) {
    valor = typeof valor === 'object' && valor !== null ? (valor as Record<string, unknown>)[parte] : undefined;
  }
  if (typeof valor !== 'string') throw new Error(`No existe el texto «${clave}» en es.json`);
  return valor
    .replace(/\{\{(\w+)\}\}/g, (_, nombre: string) => {
      const sustituto = variables[nombre];
      if (sustituto === undefined) throw new Error(`Falta la variable «${nombre}» del texto «${clave}»`);
      return sustituto;
    })
    .replace(/<\/?\d+>/g, '');
}
