import { DEFAULT_LANGUAGE, LANGUAGES } from '@sanctuary/shared';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { idiomaGuardado, idiomaInicial } from './idioma';
import ca from './locales/ca.json';
import en from './locales/en.json';
import es from './locales/es.json';

// Fase 3: castellano, valenciano (ca) e inglés (en).
const navegador = typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language]);

// `<html lang>` siempre con el idioma de la interfaz (lectores de pantalla, guiones).
i18n.on('languageChanged', (idioma) => {
  if (typeof document !== 'undefined') document.documentElement.lang = idioma;
});

void i18n.use(initReactI18next).init({
  resources: { es: { translation: es }, ca: { translation: ca }, en: { translation: en } },
  lng: idiomaInicial(idiomaGuardado(), navegador),
  supportedLngs: [...LANGUAGES],
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false }, // React ya escapa el contenido
});

export default i18n;
