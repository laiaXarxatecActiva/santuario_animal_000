import { faBars, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router';
import { ButtonLink } from './Button';
import iconStyles from './IconButton.module.css';
import { Logo } from './Logo';
import styles from './PublicHeader.module.css';
import { ThemeToggle } from './ThemeToggle';

// Enlaces del visitante (SCREENS §2.1). Los del adoptante y el trabajador
// llegarán con la sesión (CU-09).
const ENLACES = [
  { to: '/animals', key: 'nav.animals' },
  { to: '/how-it-works', key: 'nav.howItWorks' },
  { to: '/donate', key: 'nav.donate' },
  { to: '/about', key: 'nav.about' },
] as const;

export function PublicHeader() {
  const { t } = useTranslation();
  const [abierto, setAbierto] = useState(false);
  const menuId = useId();
  const { pathname } = useLocation();

  // Se cierra al cambiar de página y con la tecla Esc.
  useEffect(() => setAbierto(false), [pathname]);
  useEffect(() => {
    if (!abierto) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('keydown', alPulsar);
    return () => document.removeEventListener('keydown', alPulsar);
  }, [abierto]);

  const enlaces = (onClick?: () => void) =>
    ENLACES.map(({ to, key }) => (
      <li key={to}>
        <NavLink to={to} className={styles.link} onClick={onClick}>
          {t(key)}
        </NavLink>
      </li>
    ));

  return (
    <header className={styles.header}>
      <div className={`container ${styles.bar}`}>
        <Logo />
        <nav aria-label={t('nav.main')} className={styles.desktopNav}>
          <ul className={styles.links}>{enlaces()}</ul>
        </nav>
        <div className={styles.actions}>
          <ThemeToggle />
          <div className={styles.desktopAuth}>
            <ButtonLink to="/login" variant="ghost">
              {t('nav.login')}
            </ButtonLink>
            <ButtonLink to="/register">{t('nav.register')}</ButtonLink>
          </div>
          <button
            type="button"
            className={`${iconStyles.iconButton} ${styles.menuButton}`}
            aria-expanded={abierto}
            aria-controls={menuId}
            aria-label={abierto ? t('nav.closeMenu') : t('nav.openMenu')}
            onClick={() => setAbierto((a) => !a)}
          >
            <FontAwesomeIcon icon={abierto ? faXmark : faBars} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div id={menuId} className={styles.mobileMenu} hidden={!abierto}>
        <ul className={styles.mobileLinks}>{enlaces(() => setAbierto(false))}</ul>
        <div className={styles.mobileAuth}>
          <ButtonLink to="/login" variant="outline" block onClick={() => setAbierto(false)}>
            {t('nav.login')}
          </ButtonLink>
          <ButtonLink to="/register" block onClick={() => setAbierto(false)}>
            {t('nav.register')}
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
