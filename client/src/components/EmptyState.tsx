import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';

// Estado vacío (DESIGN_SYSTEM §8.9): icono, frase amable y acción opcional.
export function EmptyState({
  icon,
  message,
  action,
}: {
  icon: IconDefinition;
  message: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={styles.empty}>
      <FontAwesomeIcon icon={icon} aria-hidden="true" className={styles.icon} />
      <p>{message}</p>
      {action}
    </div>
  );
}
