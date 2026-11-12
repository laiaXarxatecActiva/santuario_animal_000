import { faChevronDown, faCircleUser, faRightFromBracket } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import { Button } from './Button';
import styles from './UserMenu.module.css';

export interface MenuLink {
  to: string;
  key: string;
}

interface UserMenuProps {
  name: string;
  links: readonly MenuLink[];
  onLogout: () => void;
}

// Menú de usuario de la cabecera (DESIGN_SYSTEM §8.7).
export function UserMenu({ name, links, onLogout }: UserMenuProps) {
  const { t } = useTranslation();
  const [abierto, setAbierto] = useState(false);
  const panelId = useId();
  const raiz = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const { pathname } = useLocation();

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

  return (
    <div ref={raiz} className={styles.menu}>
      <Button
        ref={boton}
        variant="outline"
        icon={faCircleUser}
        aria-expanded={abierto}
        aria-controls={panelId}
        aria-label={t('nav.userMenu', { name })}
        onClick={() => setAbierto((a) => !a)}
      >
        {name}
        <FontAwesomeIcon icon={faChevronDown} aria-hidden="true" className={styles.chevron} />
      </Button>
      <div id={panelId} className={styles.panel} hidden={!abierto}>
        {links.length > 0 && (
          <ul className={styles.list}>
            {links.map(({ to, key }) => (
              <li key={to}>
                <Link to={to} className={styles.item} onClick={() => setAbierto(false)}>
                  {t(key)}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className={`${styles.item} ${styles.logout}`}
          onClick={() => {
            setAbierto(false);
            onLogout();
          }}
        >
          <FontAwesomeIcon icon={faRightFromBracket} aria-hidden="true" />
          {t('nav.logout')}
        </button>
      </div>
    </div>
  );
}
