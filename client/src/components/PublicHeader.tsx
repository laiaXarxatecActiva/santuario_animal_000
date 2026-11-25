import { faBars, faRightFromBracket, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { isWorkerRole } from '@sanctuary/shared';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router';
import { useUnreadCount } from '../hooks/useFeed';
import { useLogout, useSession } from '../hooks/useSession';
import { ButtonLink } from './Button';
import iconStyles from './IconButton.module.css';
import { LanguageSelect } from './LanguageSelect';
import { Logo } from './Logo';
import { NotificationBell } from './NotificationBell';
import styles from './PublicHeader.module.css';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu, type MenuLink } from './UserMenu';

// Enlaces según quién navega (SCREENS §2.1). Con sesión, además, la campana (CU-18).
const VISITANTE: readonly MenuLink[] = [
  { to: '/animals', key: 'nav.animals' },
  { to: '/how-it-works', key: 'nav.howItWorks' },
  { to: '/donate', key: 'nav.donate' },
  { to: '/about', key: 'nav.about' },
];
const ADOPTANTE: readonly MenuLink[] = [
  { to: '/animals', key: 'nav.animals' },
  { to: '/how-it-works', key: 'nav.howItWorks' },
  { to: '/my-animals', key: 'nav.myAnimals' },
  { to: '/feed', key: 'nav.feed' },
  { to: '/my-contributions', key: 'nav.myContributions' },
  { to: '/donate', key: 'nav.donate' },
];
const TRABAJADOR: readonly MenuLink[] = [
  { to: '/animals', key: 'nav.animals' },
  { to: '/how-it-works', key: 'nav.howItWorks' },
  { to: '/donate', key: 'nav.donate' },
  { to: '/admin', key: 'nav.admin' },
];
// El menú de usuario solo tiene lo de la cuenta (y, aparte, «Cerrar sesión»).
const MENU_USUARIO: readonly MenuLink[] = [{ to: '/profile', key: 'nav.profile' }];

export function PublicHeader() {
  const { t } = useTranslation();
  const [abierto, setAbierto] = useState(false);
  const menuId = useId();
  const cabecera = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const { user, isLoading } = useSession();
  const logout = useLogout();

  const trabajador = user !== null && isWorkerRole(user.role);
  // CU-17 5: contador de novedades sin leer junto a «Novedades».
  const sinLeer = useUnreadCount(user?.role === 'adopter').data ?? 0;
  const enlaces = user === null ? VISITANTE : trabajador ? TRABAJADOR : ADOPTANTE;
  // Con más de cuatro enlaces la cabecera va justa: enlaces más juntos e idioma solo con icono.
  const apretada = enlaces.length > 4;
  const cerrar = () => setAbierto(false);

  // Se cierra al cambiar de página, con la tecla Esc y al pulsar fuera de la cabecera.
  useEffect(() => setAbierto(false), [pathname]);
  useEffect(() => {
    if (!abierto) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    const alPulsarFuera = (e: MouseEvent) => {
      if (e.target instanceof Node && !cabecera.current?.contains(e.target)) setAbierto(false);
    };
    document.addEventListener('keydown', alPulsar);
    document.addEventListener('mousedown', alPulsarFuera);
    return () => {
      document.removeEventListener('keydown', alPulsar);
      document.removeEventListener('mousedown', alPulsarFuera);
    };
  }, [abierto]);

  const lista = (items: readonly MenuLink[], onClick?: () => void) =>
    items.map(({ to, key }) => {
      const contador = to === '/feed' && sinLeer > 0;
      return (
        <li key={to}>
          <NavLink
            to={to}
            className={styles.link}
            onClick={onClick}
            aria-label={contador ? t('nav.feedUnread', { count: sinLeer }) : undefined}
          >
            {t(key)}
            {contador && (
              <span className={styles.counter} aria-hidden="true">
                {sinLeer > 9 ? '9+' : sinLeer}
              </span>
            )}
          </NavLink>
        </li>
      );
    });

  return (
    <header ref={cabecera} className={`${styles.header} ${apretada ? styles.crowded : ''}`}>
      <div className={`container ${styles.bar}`}>
        <Logo />
        <nav aria-label={t('nav.main')} className={styles.desktopNav}>
          <ul className={styles.links}>{lista(enlaces)}</ul>
        </nav>
        <div className={styles.actions}>
          {user && <NotificationBell />}
          <LanguageSelect compact={apretada} />
          <ThemeToggle />
          {!isLoading && (
            <div className={styles.desktopAuth}>
              {user ? (
                <UserMenu name={user.firstName} links={MENU_USUARIO} onLogout={() => logout.mutate()} />
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
            {lista(MENU_USUARIO, cerrar)}
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
