import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { ReactNode } from 'react';
import styles from './Badge.module.css';

// Insignias de estado (DESIGN_SYSTEM §8.6).
export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'error' | 'primary' | 'new';

export function Badge({
  tone = 'neutral',
  icon,
  children,
}: {
  tone?: BadgeTone;
  icon?: IconDefinition;
  children: ReactNode;
}) {
  return (
    <span className={`${styles.badge} ${styles[tone]}`}>
      {icon && <FontAwesomeIcon icon={icon} aria-hidden="true" />}
      {children}
    </span>
  );
}
