import {
  faCircleCheck,
  faCircleExclamation,
  faCircleInfo,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { ReactNode } from 'react';
import styles from './Alert.module.css';

// Avisos en línea (DESIGN_SYSTEM §8.3). El botón de cerrar y el cierre
// automático de los de éxito llegarán con los formularios.
export type AlertType = 'info' | 'success' | 'warning' | 'error';

const ICONOS = {
  info: faCircleInfo,
  success: faCircleCheck,
  warning: faTriangleExclamation,
  error: faCircleExclamation,
} as const;

interface AlertProps {
  type: AlertType;
  title?: ReactNode;
  children?: ReactNode;
  /** Acción opcional (por ejemplo, «Reintentar»). */
  action?: ReactNode;
}

export function Alert({ type, title, children, action }: AlertProps) {
  return (
    <div className={`${styles.alert} ${styles[type]}`} role={type === 'error' ? 'alert' : 'status'}>
      <FontAwesomeIcon icon={ICONOS[type]} aria-hidden="true" className={styles.icon} />
      <div className={styles.body}>
        {title && <p className={styles.title}>{title}</p>}
        {children && <div>{children}</div>}
        {action && <div className={styles.action}>{action}</div>}
      </div>
    </div>
  );
}
