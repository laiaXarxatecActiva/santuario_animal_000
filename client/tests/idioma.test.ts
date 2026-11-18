import { describe, expect, it } from 'vitest';
import i18n from '../src/i18n';
import { cambiarIdioma, idiomaInicial } from '../src/i18n/idioma';

describe('Fase 3 Idioma inicial de la web', () => {
  it('manda el que se eligió en este navegador', () => {
    expect(idiomaInicial('en', ['ca-ES'])).toBe('en');
  });

  it('si no se eligió, el primero del navegador que la web tenga', () => {
    expect(idiomaInicial(null, ['fr-FR', 'ca-ES', 'es-ES'])).toBe('ca');
    expect(idiomaInicial(null, ['en-US'])).toBe('en');
    // El valenciano se identifica también como «ca» con variante.
    expect(idiomaInicial(null, ['ca-ES-valencia'])).toBe('ca');
  });

  it('castellano si no hay ninguno de los tres o lo guardado no es válido', () => {
    expect(idiomaInicial(null, ['fr-FR', 'de'])).toBe('es');
    expect(idiomaInicial('fr', [])).toBe('es');
  });

  it('cambiarIdioma traduce la interfaz, lo recuerda y actualiza <html lang>', async () => {
    await cambiarIdioma('en');
    expect(i18n.t('nav.animals')).toBe('Animals');
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem('language')).toBe('en');
    await cambiarIdioma('es');
    expect(document.documentElement.lang).toBe('es');
  });
});
