import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faCalendarDay,
  faCalendarDays,
  faCalendarXmark,
  faChartColumn,
  faClipboardList,
  faClock,
  faClockRotateLeft,
  faEnvelope,
  faFeather,
  faFileSignature,
  faGauge,
  faHandHoldingHeart,
  faListCheck,
  faMapLocationDot,
  faMoneyBillWave,
  faNewspaper,
  faPlus,
  faRepeat,
  faStethoscope,
  faTags,
  faTriangleExclamation,
  faUserClock,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import type { Role } from '@sanctuary/shared';

// Páginas del panel por rol: las usan el menú lateral (SCREENS §5.1) y los
// accesos rápidos del escritorio (SCREENS §5.2). Solo ocultan interfaz: los
// permisos los comprueba el servidor (RN-18).

export interface Enlace {
  to: string;
  key: string;
  icon: IconDefinition;
  /** Solo se marca como activo en su ruta exacta. */
  end?: boolean;
  /** Roles que ven el enlace; sin indicar, los del grupo. */
  roles?: readonly Role[];
}

export interface Grupo {
  key?: string;
  /** Roles que ven el grupo; sin indicar, todos los trabajadores. */
  roles?: readonly Role[];
  links: readonly Enlace[];
}

// Secciones del menú (SCREENS §5.1). Cada una aparece cuando está implementada.
export const GRUPOS: readonly Grupo[] = [
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

const puedeVer = (role: Role | undefined, roles?: readonly Role[]) =>
  !roles || (role !== undefined && roles.includes(role));

/** Apartados y páginas del menú que ve un rol (sin sesión, solo los de todo el personal). */
export function enlacesDelMenu(role: Role | undefined): Grupo[] {
  return GRUPOS.filter((g) => puedeVer(role, g.roles)).map((g) => ({
    ...g,
    links: g.links.filter((enlace) => puedeVer(role, enlace.roles)),
  }));
}

/** Acciones de crear que se ofrecen como accesos rápidos; de serie, las que puede usar el rol. */
const ACCIONES: Grupo = {
  key: 'admin.dashboard.quickActions',
  links: [
    { to: '/admin/updates/new', key: 'admin.dashboard.newUpdate', icon: faPlus },
    { to: '/admin/animals/new', key: 'admin.dashboard.newAnimal', icon: faPlus },
    { to: '/admin/adoptions/new', key: 'admin.dashboard.newAdoption', icon: faPlus, roles: ['admin'] },
    { to: '/admin/donations/new', key: 'admin.dashboard.newDonation', icon: faPlus, roles: ['admin'] },
  ],
};

/** Lo que un rol puede elegir como acceso rápido, por apartados: las acciones y su menú, sin el escritorio. */
export function gruposDeAccesos(role: Role): Grupo[] {
  return [
    { ...ACCIONES, links: ACCIONES.links.filter((e) => puedeVer(role, e.roles)) },
    ...enlacesDelMenu(role).filter((g) => g.key !== undefined),
  ];
}

/** Todos los accesos que puede elegir un rol, en el orden en que se muestran. */
export function accesosDisponibles(role: Role): Enlace[] {
  return gruposDeAccesos(role).flatMap((g) => g.links);
}

/** Los accesos de serie: las acciones de crear que puede usar el rol. */
export function accesosDeSerie(role: Role): string[] {
  return ACCIONES.links.filter((e) => puedeVer(role, e.roles)).map((e) => e.to);
}
