import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { NotificationDto } from '@sanctuary/shared';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { formatRelative } from '../utils/format';
import { notificationIcon } from '../utils/notificationIcon';
import styles from './NotificationItem.module.css';

/** Contenido de una notificación (DESIGN_SYSTEM §8.8): icono, mensaje, fecha relativa y punto si no está leída. */
export function NotificationContent({ notification }: { notification: NotificationDto }) {
  const { t } = useTranslation();
  return (
    <>
      <FontAwesomeIcon
        icon={notificationIcon(notification.type)}
        aria-hidden="true"
        fixedWidth
        className={styles.icon}
      />
      <span className={styles.text}>
        <span>{notification.message}</span>
        <time dateTime={notification.createdAt} className={styles.date}>
          {formatRelative(notification.createdAt)}
        </time>
      </span>
      {!notification.isRead && (
        <span className={styles.dot}>
          <span className="visually-hidden">{t('notifications.unread')}</span>
        </span>
      )}
    </>
  );
}

/** Fila de la lista: no leídas con fondo suave; `children` es la acción (enlace o botón). */
export function NotificationRow({ notification, children }: { notification: NotificationDto; children: ReactNode }) {
  return (
    <li className={styles.row} data-unread={!notification.isRead}>
      {children}
    </li>
  );
}

export { styles as notificationStyles };
