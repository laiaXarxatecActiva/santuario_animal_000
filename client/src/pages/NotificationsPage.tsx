import { faBell, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { NotificationDto } from '@sanctuary/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Alert } from '../components/Alert';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import iconStyles from '../components/IconButton.module.css';
import { NotificationContent, NotificationRow, notificationStyles } from '../components/NotificationItem';
import { Pagination } from '../components/Pagination';
import { NOTIFICATIONS_PAGE_SIZE, useNotificationActions, useNotifications } from '../hooks/useNotifications';
import styles from './NotificationsPage.module.css';

// CU-18 Listado completo de notificaciones (SCREENS §4.7).
export function NotificationsPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const consulta = useNotifications({ page, pageSize: NOTIFICATIONS_PAGE_SIZE });
  const { setRead, readAll, remove } = useNotificationActions();
  const notificaciones = consulta.data?.data ?? [];
  const sinLeer = consulta.data?.meta.unreadCount ?? 0;

  const abrir = (n: NotificationDto) => {
    if (!n.isRead) setRead.mutate({ id: n.id, isRead: true });
  };

  let contenido;
  if (consulta.isError) {
    contenido = (
      <Alert
        type="error"
        title={t('notifications.errorLoading')}
        action={
          <Button variant="outline" onClick={() => void consulta.refetch()}>
            {t('common.retry')}
          </Button>
        }
      />
    );
  } else if (!consulta.data) {
    contenido = <p aria-busy="true">{t('common.loading')}</p>;
  } else if (notificaciones.length === 0) {
    contenido = <EmptyState icon={faBell} message={t('notifications.empty')} />;
  } else {
    contenido = (
      <>
        <ul className={styles.list} aria-label={t('notifications.title')}>
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
        <Pagination page={consulta.data.meta.page} totalPages={consulta.data.meta.totalPages} onChange={setPage} />
      </>
    );
  }

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.header}>
        <h1>{t('notifications.title')}</h1>
        {sinLeer > 0 && (
          <Button variant="outline" disabled={readAll.isPending} onClick={() => readAll.mutate()}>
            {t('notifications.readAll')}
          </Button>
        )}
      </div>
      {contenido}
    </div>
  );
}
