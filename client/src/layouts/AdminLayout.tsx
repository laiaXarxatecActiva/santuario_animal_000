import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faArrowUpRightFromSquare,
  faCalendarDays,
  faCalendarDay,
  faEnvelope,
  faTriangleExclamation,
  faCalendarXmark,
  faClipboardList,
  faClock,
  faListCheck,
  faUserClock,
  faMapLocationDot,
  faRepeat,
  faChartColumn,
  faClockRotateLeft,
  faBars,
  faChevronDown,
  faFeather,
  faGauge,
  faHandHoldingHeart,
  faNewspaper,
  faTags,
  faUsers,
  faFileSignature,
  faMoneyBillWave,
  faStethoscope,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { isWorkerRole, type Role } from '@sanctuary/shared';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { Alert } from '../components/Alert';
import iconStyles from '../components/IconButton.module.css';
import { LanguageSelect } from '../components/LanguageSelect';
import { Logo } from '../components/Logo';
import { NotificationBell } from '../components/NotificationBell';
import { ScrollToTop } from '../components/ScrollToTop';
import { ThemeToggle } from '../components/ThemeToggle';
import { UserMenu } from '../components/UserMenu';
import { useLogout, useSession } from '../hooks/useSession';
import { useSessionExpiry } from '../hooks/useSessionExpiry';
import { useIncidentSummary } from '../hooks/useWork';
import { readFlash } from '../utils/flash';
import styles from './AdminLayout.module.css';

interface Enlace {
  to: string;
  key: string;
  icon: IconDefinition;
  /** Solo se marca como activo en su ruta exacta. */
  end?: boolean;
  /** Roles que ven el enlace; sin indicar, los del grupo. */
  roles?: readonly Role[];
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
      { to: '/admin/updates', key: 'admin.nav.updates', icon: faNewspaper },
      { to: '/admin/species', key: 'admin.nav.species', icon: faTags },
      { to: '/admin/vet-records', key: 'admin.nav.vet', icon: faStethoscope },
    ],
  },
  {
    key: 'admin.nav.groupWork',
    links: [
      { to: '/admin/today', key: 'admin.nav.today', icon: faCalendarDay, roles: ['admin'] },
      { to: '/admin/my-day', key: 'admin.nav.myDay', icon: faListCheck },
      { to: '/admin/my-shifts', key: 'admin.nav.myShifts', icon: faUserClock },
      { to: '/admin/incidents', key: 'admin.nav.incidents', icon: faTriangleExclamation },
      { to: '/admin/shifts', key: 'admin.nav.shifts', icon: faCalendarDays },
      { to: '/admin/tasks', key: 'admin.nav.tasks', icon: faClipboardList, roles: ['admin'] },
      { to: '/admin/task-templates', key: 'admin.nav.taskTemplates', icon: faRepeat, roles: ['admin'] },
      { to: '/admin/zones', key: 'admin.nav.zones', icon: faMapLocationDot, roles: ['admin'] },
      { to: '/admin/shift-templates', key: 'admin.nav.shiftTemplates', icon: faClock, roles: ['admin'] },
      { to: '/admin/absences', key: 'admin.nav.absences', icon: faCalendarXmark, roles: ['admin'] },
      { to: '/admin/alert-settings', key: 'admin.nav.alertSettings', icon: faEnvelope, roles: ['admin'] },
    ],
  },
  {
    key: 'admin.nav.groupAdmin',
    roles: ['admin'],
    links: [
      { to: '/admin/users', key: 'admin.nav.users', icon: faUsers },
      { to: '/admin/adoptions', key: 'admin.nav.adoptions', icon: faFileSignature },
      { to: '/admin/payments', key: 'admin.nav.payments', icon: faMoneyBillWave },
      { to: '/admin/donations', key: 'admin.nav.donations', icon: faHandHoldingHeart },
      { to: '/admin/plans', key: 'admin.nav.plans', icon: faHandHoldingHeart },
      { to: '/admin/stats', key: 'admin.nav.stats', icon: faChartColumn },
      { to: '/admin/activity', key: 'admin.nav.activity', icon: faClockRotateLeft },
    ],
  },
];

const CLAVE_APARTADOS = 'panel-menu';
/** En el escritorio, que no es de ningún apartado, se abre el más usado. */
const APARTADO_DEL_ESCRITORIO = 'admin.nav.groupWork';

/** Apartados abiertos o cerrados por la persona (se recuerdan en este navegador). */
function leerApartados(): Record<string, boolean> {
  try {
    const guardado: unknown = JSON.parse(localStorage.getItem(CLAVE_APARTADOS) ?? '{}');
    return guardado !== null && typeof guardado === 'object' ? (guardado as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

/** El apartado al que pertenece una ruta, si es de alguno. */
function apartadoDe(pathname: string): string | undefined {
  const grupo = GRUPOS.find((g) => g.key && g.links.some((e) => pathname === e.to || pathname.startsWith(`${e.to}/`)));
  return grupo?.key ?? (pathname === '/admin' ? APARTADO_DEL_ESCRITORIO : undefined);
}

const MENU_USUARIO = [{ to: '/profile', key: 'nav.profile' }] as const;

// Plantilla del panel de gestión (DESIGN_SYSTEM §8.10). Solo oculta interfaz:
// los permisos los comprueba el servidor (RN-18).
export function AdminLayout() {
  const { t } = useTranslation();
  const { user } = useSession();
  const logout = useLogout();
  useSessionExpiry();
  const location = useLocation();
  const { pathname } = location;
  const [abierto, setAbierto] = useState(false);
  // El aviso de la navegación se cierra solo para esta entrada del historial.
  const [flashCerrado, setFlashCerrado] = useState<string | null>(null);
  const flash = flashCerrado === location.key ? undefined : readFlash(location.state);
  const menuId = useId();
  const lateral = useRef<HTMLElement>(null);
  const hamburguesa = useRef<HTMLButtonElement>(null);
  // CU-70: incidencias pendientes junto a «Incidencias».
  const resumen = useIncidentSummary(user !== null && isWorkerRole(user.role));
  const pendientes = resumen.data ? resumen.data.open + resumen.data.inProgress : 0;
  const [apartados, setApartados] = useState<Record<string, boolean>>(leerApartados);
  const actual = apartadoDe(pathname);
  const estaAbierto = (clave: string) => apartados[clave] ?? clave === actual;
  const alternar = (clave: string) => {
    const nuevos = { ...apartados, [clave]: !estaAbierto(clave) };
    setApartados(nuevos);
    localStorage.setItem(CLAVE_APARTADOS, JSON.stringify(nuevos));
  };
  // Al llegar a una página de un apartado cerrado, se abre para que se vea dónde se está.
  useEffect(() => {
    if (pathname !== '/admin' && actual) setApartados((a) => (a[actual] === false ? { ...a, [actual]: true } : a));
  }, [pathname, actual]);

  // En móvil, el menú se cierra al cambiar de página, con Esc y al pulsar fuera de él
  // (la hamburguesa no cuenta: ella misma lo abre y lo cierra).
  useEffect(() => setAbierto(false), [pathname]);
  useEffect(() => {
    if (!abierto) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    const alPulsarFuera = (e: MouseEvent) => {
      if (!(e.target instanceof Node)) return;
      if (lateral.current?.contains(e.target) || hamburguesa.current?.contains(e.target)) return;
      setAbierto(false);
    };
    document.addEventListener('keydown', alPulsar);
    document.addEventListener('mousedown', alPulsarFuera);
    return () => {
      document.removeEventListener('keydown', alPulsar);
      document.removeEventListener('mousedown', alPulsarFuera);
    };
  }, [abierto]);

  const puedeVer = (roles?: readonly Role[]) => !roles || (user !== null && roles.includes(user.role));
  const grupos = GRUPOS.filter((g) => puedeVer(g.roles)).map((g) => ({
    ...g,
    links: g.links.filter((enlace) => puedeVer(enlace.roles)),
  }));

  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skipLink}>
        {t('common.skipToContent')}
      </a>
      <header className={styles.topbar}>
        <button
          ref={hamburguesa}
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
          {user && <NotificationBell />}
          <LanguageSelect />
          <ThemeToggle />
          {user && <UserMenu name={user.firstName} links={MENU_USUARIO} onLogout={() => logout.mutate()} />}
        </div>
      </header>
      <aside ref={lateral} id={menuId} className={styles.sidebar} data-open={abierto}>
        <div className={styles.brand}>
          <Logo />
          <span className={styles.brandSub}>{t('admin.nav.title')}</span>
        </div>
        <nav aria-label={t('admin.nav.label')}>
          {grupos.map((grupo, i) => (
            <div key={grupo.key ?? i} className={styles.group}>
              {grupo.key && (
                <button
                  type="button"
                  className={styles.groupTitle}
                  aria-expanded={estaAbierto(grupo.key)}
                  aria-controls={`${menuId}-${i}`}
                  onClick={() => grupo.key && alternar(grupo.key)}
                >
                  {t(grupo.key)}
                  <FontAwesomeIcon icon={faChevronDown} aria-hidden="true" className={styles.groupIcon} />
                </button>
              )}
              <ul id={`${menuId}-${i}`} hidden={grupo.key !== undefined && !estaAbierto(grupo.key)}>
                {grupo.links.map((enlace) => (
                  <li key={enlace.to}>
                    {enlace.to === '/admin/incidents' && pendientes > 0 ? (
                      <>
                        <NavLink to={enlace.to} className={styles.link} aria-describedby={`${menuId}-pendientes`}>
                          <FontAwesomeIcon icon={enlace.icon} aria-hidden="true" fixedWidth />
                          {t(enlace.key)}
                          <span className={styles.count} aria-hidden="true">
                            {pendientes}
                          </span>
                        </NavLink>
                        <span id={`${menuId}-pendientes`} className="visually-hidden">
                          {t('admin.nav.pending', { count: pendientes })}
                        </span>
                      </>
                    ) : (
                      <NavLink to={enlace.to} end={enlace.end} className={styles.link}>
                        <FontAwesomeIcon icon={enlace.icon} aria-hidden="true" fixedWidth />
                        {t(enlace.key)}
                      </NavLink>
                    )}
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
        <ScrollToTop />
        <Outlet />
      </main>
    </div>
  );
}
