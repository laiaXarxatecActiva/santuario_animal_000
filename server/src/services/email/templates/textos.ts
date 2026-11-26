import type { Language } from '@sanctuary/shared';

// Piezas comunes de los emails en los tres idiomas (Fase 3).

/** El nombre del santuario es una marca: no se traduce. */
export const FIRMA = 'Santuario de Animales';

export const saludo = (idioma: Language, nombre: string | null): string =>
  nombre
    ? { es: `Hola, ${nombre}:`, ca: `Hola, ${nombre}:`, en: `Hello ${nombre},` }[idioma]
    : { es: 'Hola:', ca: 'Hola:', en: 'Hello,' }[idioma];

export const VER_MIS_ANIMALES: Record<Language, string> = {
  es: 'Ver mis animales',
  ca: 'Veure els meus animals',
  en: 'See my animals',
};

export const idiomaDe = (datos: { language?: Language | undefined }): Language => datos.language ?? 'es';
