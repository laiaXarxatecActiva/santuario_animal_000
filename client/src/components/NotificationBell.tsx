import { faBell, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { NotificationDto } from '@sanctuary/shared';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import { BELL_SIZE, useNotificationActions, useNotifications } from '../hooks/useNotifications';
import iconStyles from './IconButton.module.css';
import styles from './NotificationBell.module.css';
import { NotificationContent, NotificationRow, notificationStyles } from './NotificationItem';

// Campana de la cabecera (DESIGN_SYSTEM §8.8, CU-18): contador de no leídas y
// panel desplegable con las 10 últimas.
export function NotificationBell() {
  const { t } = useTranslation();
  const [abierto, setAbierto] = useState(false);
  const panelId = useId();
  const raiz = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const { pathname } = useLocation();
  const ultimas = useNotifications({ pageSize: BELL_SIZE });
  const { setRead, remove } = useNotificationActions();
  const sinLeer = ultimas.data?.meta.unreadCount ?? 0;
  const notificaciones = ultimas.data?.data ?? [];

  useEffect(() => setAbierto(false), [pathname]);

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

  const abrir = (notificacion: NotificationDto) => {
    setAbierto(false);
    if (!notificacion.isRead) setRead.mutate({ id: notificacion.id, isRead: true });
  };

  return (
    <div ref={raiz} className={styles.bell}>
      <button
        ref={boton}
        type="button"
        className={iconStyles.iconButton}
        aria-expanded={abierto}
        aria-controls={panelId}
        aria-label={sinLeer > 0 ? t('notifications.bellUnread', { count: sinLeer }) : t('notifications.title')}
        onClick={() => setAbierto((a) => !a)}
      >
        <FontAwesomeIcon icon={faBell} aria-hidden="true" />
        {sinLeer > 0 && (
          <span className={styles.counter} aria-hidden="true">
            {sinLeer > 9 ? '9+' : sinLeer}
          </span>
        )}
      </button>
      <div id={panelId} role="region" aria-label={t('notifications.title')} className={styles.panel} hidden={!abierto}>
        {notificaciones.length === 0 ? (
          <p className={styles.empty}>{ultimas.isPending ? t('common.loading') : t('notifications.empty')}</p>
        ) : (
          <ul className={styles.list}>
            {notificaciones.map((n) => (
              <NotificationRow key={n.id} notification={n}>
                {n.link ? (
                  <Link to={n.link} className={notificationStyles.action} onClick={() => abrir(n)}>
                    <NotificationContent notification={n} />
                  </Link>
                ) : (
                  <button type="button" className={notificationStyles.action} onClick={() => abrir(n)}>
                    <NotificationContent notification={n} />
                  </button>
                )}
                <button
                  type="button"
                  className={`${iconStyles.iconButton} ${styles.delete}`}
                  aria-label={t('notifications.delete', { message: n.message })}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(n.id)}
                >
                  <FontAwesomeIcon icon={faTrashCan} aria-hidden="true" />
                </button>
              </NotificationRow>
            ))}
          </ul>
        )}
        <Link to="/notifications" className={styles.all} onClick={() => setAbierto(false)}>
          {t('notifications.seeAll')}
        </Link>
      </div>
    </div>
  );
}
