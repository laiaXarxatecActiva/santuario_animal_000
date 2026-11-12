import { faFeather } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useSession } from '../hooks/useSession';
import { ButtonLink } from './Button';
import { EmptyState } from './EmptyState';

/**
 * Rutas del área del adoptante. Sin sesión se inicia sesión y se vuelve aquí;
 * con otro rol, «Sin permiso» (SCREENS §6). Solo oculta interfaz: los permisos
 * los comprueba siempre el servidor (RN-18).
 */
export function AdopterRoute() {
  const { t } = useTranslation();
  const location = useLocation();
  const { user, isLoading } = useSession();

  if (isLoading) {
    return (
      <div className="container" aria-busy="true">
        <p>{t('common.loading')}</p>
      </div>
    );
  }
  if (!user) {
    const origen = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(origen)}`} replace />;
  }
  if (user.role !== 'adopter') {
    return (
      <div className="container">
        <EmptyState
          icon={faFeather}
          message={t('forbidden.title')}
          action={<ButtonLink to="/">{t('notFound.home')}</ButtonLink>}
        />
      </div>
    );
  }
  return <Outlet />;
}
