import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { ReactNode } from 'react';
import styles from './SelectArrow.module.css';

interface SelectArrowProps {
  children: ReactNode;
  className?: string;
  /** Clase extra para la flecha (p. ej., ocultarla en el selector de idioma en móvil). */
  arrowClassName?: string;
}

/**
 * Envuelve un `<select>` nativo y sustituye la flecha del navegador por el
 * `chevron-down` del menú de usuario (DESIGN_SYSTEM §8.5).
 */
export function SelectArrow({ children, className, arrowClassName }: SelectArrowProps) {
  return (
    <div className={`${styles.wrapper} ${className ?? ''}`}>
      {children}
      <FontAwesomeIcon icon={faChevronDown} aria-hidden="true" className={`${styles.arrow} ${arrowClassName ?? ''}`} />
    </div>
  );
}
