import {
  faCircleCheck,
  faCircleExclamation,
  faCircleInfo,
  faTriangleExclamation,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './Alert.module.css';

// Avisos en línea (DESIGN_SYSTEM §8.3).
export type AlertType = 'info' | 'success' | 'warning' | 'error';

const ICONOS = {
  info: faCircleInfo,
  success: faCircleCheck,
  warning: faTriangleExclamation,
  error: faCircleExclamation,
} as const;

// Los avisos de éxito se cierran solos a los 6 segundos.
const CIERRE_AUTOMATICO_MS = 6000;

interface AlertProps {
  type: AlertType;
  title?: ReactNode;
  children?: ReactNode;
  /** Acción opcional (por ejemplo, «Reintentar»). */
  action?: ReactNode;
  /** Si se indica, el aviso se puede cerrar (y el de éxito se cierra solo). */
  onClose?: () => void;
}

export function Alert({ type, title, children, action, onClose }: AlertProps) {
  const { t } = useTranslation();
  const [pausado, setPausado] = useState(false);
  const cerrar = useRef(onClose);
  useEffect(() => {
    cerrar.current = onClose;
  });

  const cierraSolo = type === 'success' && onClose !== undefined;
  useEffect(() => {
    if (!cierraSolo || pausado) return;
    const id = setTimeout(() => cerrar.current?.(), CIERRE_AUTOMATICO_MS);
    return () => clearTimeout(id);
  }, [cierraSolo, pausado]);

  return (
    <div
      className={`${styles.alert} ${styles[type]}`}
      role={type === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
    >
      <FontAwesomeIcon icon={ICONOS[type]} aria-hidden="true" className={styles.icon} />
      <div className={styles.body}>
        {title && <p className={styles.title}>{title}</p>}
        {children && <div>{children}</div>}
        {action && <div className={styles.action}>{action}</div>}
      </div>
      {onClose && (
        <button type="button" className={styles.close} aria-label={t('alert.close')} onClick={onClose}>
          <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
