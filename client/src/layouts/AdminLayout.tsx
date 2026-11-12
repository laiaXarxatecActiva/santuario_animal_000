import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faArrowUpRightFromSquare,
  faBars,
  faFeather,
  faGauge,
  faTags,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { Role } from '@sanctuary/shared';
import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { Alert } from '../components/Alert';
import iconStyles from '../components/IconButton.module.css';
import { Logo } from '../components/Logo';
import { ThemeToggle } from '../components/ThemeToggle';
import { UserMenu } from '../components/UserMenu';
import { useLogout, useSession } from '../hooks/useSession';
import { readFlash } from '../utils/flash';
import styles from './AdminLayout.module.css';

interface Enlace {
  to: string;
  key: string;
  icon: IconDefinition;
  /** Solo se marca como activo en su ruta exacta. */
  end?: boolean;
}

interface Grupo {
  key?: string;
  /** Roles que ven el grupo; sin indicar, todos los trabajadores. */
  roles?: readonly Role[];
  links: readonly Enlace[];
}

// Secciones del menú (SCREENS §5.1). Cada una aparece cuando está implementada.
const GRUPOS: readonly Grupo[] = [
  { links: [{ to: '/admin', key: 'admin.nav.dashboard', icon: faGauge, end: true }] },
  {
    key: 'admin.nav.groupAnimals',
    links: [
      { to: '/admin/animals', key: 'admin.nav.animals', icon: faFeather },
      { to: '/admin/species', key: 'admin.nav.species', icon: faTags },
    ],
  },
];

const MENU_USUARIO = [{ to: '/profile', key: 'nav.profile' }] as const;

// Plantilla del panel de gestión (DESIGN_SYSTEM §8.10). Solo oculta interfaz:
// los permisos los comprueba el servidor (RN-18).
export function AdminLayout() {
  const { t } = useTranslation();
  const { user } = useSession();
  const logout = useLogout();
  const location = useLocation();
  const { pathname } = location;
  const [abierto, setAbierto] = useState(false);
  // El aviso de la navegación se cierra solo para esta entrada del historial.
  const [flashCerrado, setFlashCerrado] = useState<string | null>(null);
  const flash = flashCerrado === location.key ? undefined : readFlash(location.state);
  const menuId = useId();

  useEffect(() => setAbierto(false), [pathname]);
  useEffect(() => {
    if (!abierto) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('keydown', alPulsar);
    return () => document.removeEventListener('keydown', alPulsar);
  }, [abierto]);

  const grupos = GRUPOS.filter((g) => !g.roles || (user !== null && g.roles.includes(user.role)));

  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skipLink}>
        {t('common.skipToContent')}
      </a>
      <header className={styles.topbar}>
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
        <span className={styles.title}>{t('admin.nav.title')}</span>
        <div className={styles.actions}>
          <ThemeToggle />
          {user && <UserMenu name={user.firstName} links={MENU_USUARIO} onLogout={() => logout.mutate()} />}
        </div>
      </header>
      <aside id={menuId} className={styles.sidebar} data-open={abierto}>
        <div className={styles.brand}>
          <Logo />
          <span className={styles.brandSub}>{t('admin.nav.title')}</span>
        </div>
        <nav aria-label={t('admin.nav.label')}>
          {grupos.map((grupo, i) => (
            <div key={grupo.key ?? i} className={styles.group}>
              {grupo.key && <p className={styles.groupTitle}>{t(grupo.key)}</p>}
              <ul>
                {grupo.links.map((enlace) => (
                  <li key={enlace.to}>
                    <NavLink to={enlace.to} end={enlace.end} className={styles.link}>
                      <FontAwesomeIcon icon={enlace.icon} aria-hidden="true" fixedWidth />
                      {t(enlace.key)}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className={`${styles.group} ${styles.footer}`}>
            <Link to="/" className={styles.link}>
              <FontAwesomeIcon icon={faArrowUpRightFromSquare} aria-hidden="true" fixedWidth />
              {t('admin.nav.viewSite')}
            </Link>
          </div>
        </nav>
      </aside>
      <main id="main" tabIndex={-1} className={styles.main}>
        {flash && (
          <div className={styles.flash}>
            <Alert type={flash.type} onClose={() => setFlashCerrado(location.key)}>
              {flash.message}
            </Alert>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
