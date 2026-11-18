import { describe, expect, it } from 'vitest';
import ca from '../src/i18n/locales/ca.json';
import en from '../src/i18n/locales/en.json';
import es from '../src/i18n/locales/es.json';

type Arbol = { [clave: string]: string | Arbol };

function hojas(arbol: Arbol, prefijo = ''): Map<string, string> {
  const todas = new Map<string, string>();
  for (const [clave, valor] of Object.entries(arbol)) {
    if (typeof valor === 'string') todas.set(prefijo + clave, valor);
    else for (const [k, v] of hojas(valor, `${prefijo}${clave}.`)) todas.set(k, v);
  }
  return todas;
}

/** Variables `{{x}}` y etiquetas `<0>` de un texto, que las traducciones deben conservar. */
const marcas = (texto: string) =>
  [...texto.matchAll(/\{\{\s*\w+\s*\}\}|<\/?\d+>|<\/?strong>/g)].map((m) => m[0]).sort();

describe('Fase 3 Traducciones de la interfaz (ca, en)', () => {
  const base = hojas(es as Arbol);

  for (const [idioma, textos] of [
    ['ca', ca],
    ['en', en],
  ] as const) {
    const traducidas = hojas(textos as Arbol);

    it(`${idioma}: tiene exactamente las mismas claves que es`, () => {
      expect([...traducidas.keys()].sort()).toEqual([...base.keys()].sort());
    });

    it(`${idioma}: conserva las variables y etiquetas de cada texto`, () => {
      for (const [clave, texto] of base) expect(marcas(traducidas.get(clave) ?? ''), clave).toEqual(marcas(texto));
    });

    it(`${idioma}: ningún texto está vacío`, () => {
      for (const [clave, texto] of traducidas) expect(texto.trim(), clave).not.toBe('');
    });
  }
});
