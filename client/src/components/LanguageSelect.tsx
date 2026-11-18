import { faLanguage } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { LANGUAGES, isLanguage, type Language } from '@sanctuary/shared';
import { useEffect, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { profileApi } from '../api/profile';
import { useSession, useSetSession } from '../hooks/useSession';
import { cambiarIdioma, idiomaActual } from '../i18n/idioma';
import styles from './LanguageSelect.module.css';

/**
 * Selector de idioma de la cabecera (DESIGN_SYSTEM §8.7). Con sesión, el idioma
 * se guarda también en la cuenta (emails y PDF) y, al entrar, se aplica el suyo.
 */
export function LanguageSelect() {
  const { t } = useTranslation();
  const id = useId();
  const { user } = useSession();
  const setSession = useSetSession();
  const guardado = user?.preferredLanguage;

  // Al entrar (o recargar con sesión) manda el idioma de la cuenta.
  useEffect(() => {
    if (guardado && guardado !== idiomaActual()) void cambiarIdioma(guardado);
  }, [guardado]);

  const elegir = (idioma: Language) => {
    void cambiarIdioma(idioma);
    if (!user) return;
    setSession({ ...user, preferredLanguage: idioma });
    // Si falla, la web sigue en el idioma elegido; la cuenta se corrige desde el perfil.
    profileApi.update({ preferredLanguage: idioma }).catch(() => {});
  };

  return (
    <div className={styles.wrapper}>
      <label htmlFor={id} className="visually-hidden">
        {t('language.label')}
      </label>
      <FontAwesomeIcon icon={faLanguage} className={styles.icon} aria-hidden="true" />
      <select
        id={id}
        className={styles.select}
        value={idiomaActual()}
        onChange={(e) => isLanguage(e.target.value) && elegir(e.target.value)}
      >
        {LANGUAGES.map((idioma) => (
          <option key={idioma} value={idioma} lang={idioma}>
            {t(`language.names.${idioma}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
