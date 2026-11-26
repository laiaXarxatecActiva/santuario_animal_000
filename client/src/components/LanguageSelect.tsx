import { faCheck, faChevronDown, faChevronUp, faLanguage } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { LANGUAGES, type Language } from '@sanctuary/shared';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { profileApi } from '../api/profile';
import { useSession, useSetSession } from '../hooks/useSession';
import { cambiarIdioma, idiomaActual } from '../i18n/idioma';
import styles from './LanguageSelect.module.css';

/**
 * Selector de idioma de la cabecera (DESIGN_SYSTEM §8.7): botón con su panel,
 * igual que el menú de usuario. Con sesión, el idioma se guarda también en la
 * cuenta (emails y PDF) y, al entrar, se aplica el suyo. En todas las cabeceras
 * (con o sin sesión, sea cual sea el rol) el botón muestra solo el icono y la
 * flecha; el nombre del idioma queda en su nombre accesible.
 */
export function LanguageSelect() {
  const { t } = useTranslation();
  const [abierto, setAbierto] = useState(false);
  const panelId = useId();
  const etiquetaId = useId();
  const nombreId = useId();
  const raiz = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const { user } = useSession();
  const setSession = useSetSession();
  const guardado = user?.preferredLanguage;
  const actual = idiomaActual();

  // Al entrar (o recargar con sesión) manda el idioma de la cuenta.
  useEffect(() => {
    if (guardado && guardado !== idiomaActual()) void cambiarIdioma(guardado);
  }, [guardado]);

  // Se cierra con Esc (devolviendo el foco al botón) y al pulsar fuera.
  useEffect(() => {
    if (!abierto) return;
    const alPulsarTecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setAbierto(false);
      boton.current?.focus();
    };
    const alPulsarFuera = (e: MouseEvent) => {
      if (e.target instanceof Node && !raiz.current?.contains(e.target)) setAbierto(false);
    };
    document.addEventListener('keydown', alPulsarTecla);
    document.addEventListener('mousedown', alPulsarFuera);
    return () => {
      document.removeEventListener('keydown', alPulsarTecla);
      document.removeEventListener('mousedown', alPulsarFuera);
    };
  }, [abierto]);

  const elegir = (idioma: Language) => {
    setAbierto(false);
    boton.current?.focus();
    if (idioma === actual) return;
    void cambiarIdioma(idioma);
    if (!user) return;
    setSession({ ...user, preferredLanguage: idioma });
    // Si falla, la web sigue en el idioma elegido; la cuenta se corrige desde el perfil.
    profileApi.update({ preferredLanguage: idioma }).catch(() => {});
  };

  return (
    <div ref={raiz} className={styles.menu}>
      <button
        ref={boton}
        type="button"
        className={styles.button}
        aria-labelledby={`${etiquetaId} ${nombreId}`}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={panelId}
        onClick={() => setAbierto((a) => !a)}
      >
        <span id={etiquetaId} className="visually-hidden">
          {t('language.label')}
        </span>
        <FontAwesomeIcon icon={faLanguage} aria-hidden="true" className={styles.icon} />
        <span id={nombreId} lang={actual} className="visually-hidden">
          {t(`language.names.${actual}`)}
        </span>
        {/* La flecha apunta hacia arriba mientras el panel está abierto. */}
        <FontAwesomeIcon icon={abierto ? faChevronUp : faChevronDown} aria-hidden="true" className={styles.chevron} />
      </button>
      <ul
        id={panelId}
        role="menu"
        aria-label={t('language.label')}
        className={`${styles.panel} dropdown-panel`}
        hidden={!abierto}
      >
        {LANGUAGES.map((idioma) => (
          <li key={idioma} role="none">
            <button
              type="button"
              role="menuitemradio"
              aria-checked={idioma === actual}
              lang={idioma}
              className={styles.item}
              onClick={() => elegir(idioma)}
            >
              {t(`language.names.${idioma}`)}
              {idioma === actual && <FontAwesomeIcon icon={faCheck} aria-hidden="true" className={styles.check} />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
