import { faBars, faRightFromBracket, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { isWorkerRole } from '@sanctuary/shared';
import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router';
import { useLogout, useSession } from '../hooks/useSession';
import { ButtonLink } from './Button';
import iconStyles from './IconButton.module.css';
import { Logo } from './Logo';
import styles from './PublicHeader.module.css';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu, type MenuLink } from './UserMenu';

// Enlaces según quién navega (SCREENS §2.1). La campana llegará con CU-18.
const VISITANTE: readonly MenuLink[] = [
  { to: '/animals', key: 'nav.animals' },
  { to: '/how-it-works', key: 'nav.howItWorks' },
  { to: '/donate', key: 'nav.donate' },
  { to: '/about', key: 'nav.about' },
];
const ADOPTANTE: readonly MenuLink[] = [
  { to: '/animals', key: 'nav.animals' },
  { to: '/my-animals', key: 'nav.myAnimals' },
  { to: '/feed', key: 'nav.feed' },
  { to: '/donate', key: 'nav.donate' },
];
const TRABAJADOR: readonly MenuLink[] = [
  { to: '/animals', key: 'nav.animals' },
  { to: '/how-it-works', key: 'nav.howItWorks' },
  { to: '/donate', key: 'nav.donate' },
  { to: '/admin', key: 'nav.admin' },
];
const MENU_ADOPTANTE: readonly MenuLink[] = [
  { to: '/my-contributions', key: 'nav.myContributions' },
  { to: '/profile', key: 'nav.profile' },
  { to: '/how-it-works', key: 'nav.howItWorks' },
];
const MENU_TRABAJADOR: readonly MenuLink[] = [{ to: '/profile', key: 'nav.profile' }];

export function PublicHeader() {
  const { t } = useTranslation();
  const [abierto, setAbierto] = useState(false);
  const menuId = useId();
  const { pathname } = useLocation();
  const { user, isLoading } = useSession();
  const logout = useLogout();

  const trabajador = user !== null && isWorkerRole(user.role);
  const enlaces = user === null ? VISITANTE : trabajador ? TRABAJADOR : ADOPTANTE;
  const menuUsuario = trabajador ? MENU_TRABAJADOR : MENU_ADOPTANTE;
  const cerrar = () => setAbierto(false);

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

  const lista = (items: readonly MenuLink[], onClick?: () => void) =>
    items.map(({ to, key }) => (
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
          <ul className={styles.links}>{lista(enlaces)}</ul>
        </nav>
        <div className={styles.actions}>
          <ThemeToggle />
          {!isLoading && (
            <div className={styles.desktopAuth}>
              {user ? (
                <UserMenu name={user.firstName} links={menuUsuario} onLogout={() => logout.mutate()} />
              ) : (
                <>
                  <ButtonLink to="/login" variant="ghost">
                    {t('nav.login')}
                  </ButtonLink>
                  <ButtonLink to="/register">{t('nav.register')}</ButtonLink>
                </>
              )}
            </div>
          )}
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
        <ul className={styles.mobileLinks}>{lista(enlaces, cerrar)}</ul>
        {user ? (
          <ul className={`${styles.mobileLinks} ${styles.mobileUser}`}>
            {lista(menuUsuario, cerrar)}
            <li>
              <button
                type="button"
                className={styles.link}
                onClick={() => {
                  cerrar();
                  logout.mutate();
                }}
              >
                <FontAwesomeIcon icon={faRightFromBracket} aria-hidden="true" />
                {t('nav.logout')}
              </button>
            </li>
          </ul>
        ) : (
          !isLoading && (
            <div className={styles.mobileAuth}>
              <ButtonLink to="/login" variant="outline" block onClick={cerrar}>
                {t('nav.login')}
              </ButtonLink>
              <ButtonLink to="/register" block onClick={cerrar}>
                {t('nav.register')}
              </ButtonLink>
            </div>
          )
        )}
      </div>
    </header>
  );
}
