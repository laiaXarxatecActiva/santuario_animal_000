import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { Link, type LinkProps } from 'react-router';
import styles from './Button.module.css';

// Botones en píldora (DESIGN_SYSTEM §8.1).
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';

interface Comunes {
  variant?: ButtonVariant;
  icon?: IconDefinition;
  /** Ocupa todo el ancho (botones principales en móvil). */
  block?: boolean;
  children: ReactNode;
}

const clases = (variant: ButtonVariant, block: boolean | undefined, extra?: string) =>
  [styles.button, styles[variant], block ? styles.block : '', extra ?? ''].filter(Boolean).join(' ');

const Contenido = ({ icon, children }: Pick<Comunes, 'icon' | 'children'>) => (
  <>
    {icon && <FontAwesomeIcon icon={icon} aria-hidden="true" />}
    {children}
  </>
);

export function Button({
  variant = 'primary',
  icon,
  block,
  children,
  className,
  type = 'button',
  ...rest
}: Comunes & ButtonHTMLAttributes<HTMLButtonElement> & { ref?: Ref<HTMLButtonElement> }) {
  return (
    <button type={type} className={clases(variant, block, className)} {...rest}>
      <Contenido icon={icon}>{children}</Contenido>
    </button>
  );
}

/** Enlace con aspecto de botón (navegación, no acciones). */
export function ButtonLink({ variant = 'primary', icon, block, children, className, ...rest }: Comunes & LinkProps) {
  return (
    <Link className={clases(variant, block, className)} {...rest}>
      <Contenido icon={icon}>{children}</Contenido>
    </Link>
  );
}
