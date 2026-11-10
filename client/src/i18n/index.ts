import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import es from './locales/es.json';

// De momento solo castellano; valenciano (ca) e inglés (en) llegan en la Fase 3.
void i18n.use(initReactI18next).init({
  resources: { es: { translation: es } },
  lng: 'es',
  fallbackLng: 'es',
  interpolation: { escapeValue: false }, // React ya escapa el contenido
});

export default i18n;
