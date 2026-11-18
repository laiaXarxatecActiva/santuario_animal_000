import { DEFAULT_LANGUAGE, isLanguage, LANGUAGES, type Language } from '@sanctuary/shared';
import i18n from 'i18next';

// Fase 3: idioma de la web. Manda el de la cuenta (al entrar), después el que
// se eligió en este navegador, después el del navegador y, si no, castellano.

const CLAVE = 'language';

/** Idioma con el que arranca la web, antes de saber si hay sesión. */
export function idiomaInicial(guardado: string | null, navegador: readonly string[]): Language {
  if (guardado && isLanguage(guardado)) return guardado;
  for (const etiqueta of navegador) {
    const base = etiqueta.toLowerCase().split('-')[0] ?? '';
    if (isLanguage(base)) return base;
  }
  return DEFAULT_LANGUAGE;
}

export function idiomaGuardado(): string | null {
  try {
    return localStorage.getItem(CLAVE);
  } catch {
    return null;
  }
}

/** Idioma actual de la interfaz. */
export const idiomaActual = (): Language => (isLanguage(i18n.language) ? i18n.language : DEFAULT_LANGUAGE);

/** Traduce la interfaz y recuerda la elección en este navegador. `<html lang>` cambia con el evento de i18next. */
export async function cambiarIdioma(idioma: Language): Promise<void> {
  try {
    localStorage.setItem(CLAVE, idioma);
  } catch {
    // Sin acceso a localStorage: el cambio dura hasta recargar.
  }
  await i18n.changeLanguage(idioma);
}

/**
 * Campo con el idioma de la web para enviarlo al servidor (registro, donación).
 * El castellano no se envía: es el valor por defecto del servidor.
 */
export function conIdioma<K extends string>(campo: K): Partial<Record<K, Language>> {
  const idioma = idiomaActual();
  return idioma === DEFAULT_LANGUAGE ? {} : ({ [campo]: idioma } as Record<K, Language>);
}

export { LANGUAGES };
