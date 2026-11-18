// Fase 3: idiomas de la interfaz, los emails y los PDF. Debe coincidir con el
// CHECK de users.preferred_language en seedsql.sql.
export const LANGUAGES = ['es', 'ca', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'es';

export const isLanguage = (valor: unknown): valor is Language =>
  typeof valor === 'string' && (LANGUAGES as readonly string[]).includes(valor);
