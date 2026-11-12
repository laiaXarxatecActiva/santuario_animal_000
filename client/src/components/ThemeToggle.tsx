import { faMoon, faSun } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './IconButton.module.css';

type Theme = 'light' | 'dark';

const temaActual = (): Theme => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

// Botón de modo claro/oscuro (DESIGN_SYSTEM §3). El tema inicial lo aplica el
// script de index.html antes de cargar React.
export function ThemeToggle() {
  const { t } = useTranslation();
  const [tema, setTema] = useState<Theme>(temaActual);
  const oscuro = tema === 'dark';

  const cambiar = () => {
    const nuevo: Theme = oscuro ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nuevo);
    try {
      localStorage.setItem('theme', nuevo);
    } catch {
      // Sin acceso a localStorage: el cambio dura hasta recargar.
    }
    setTema(nuevo);
  };

  return (
    <button
      type="button"
      className={styles.iconButton}
      aria-label={oscuro ? t('theme.toLight') : t('theme.toDark')}
      aria-pressed={oscuro}
      onClick={cambiar}
    >
      <FontAwesomeIcon icon={oscuro ? faSun : faMoon} aria-hidden="true" />
    </button>
  );
}
