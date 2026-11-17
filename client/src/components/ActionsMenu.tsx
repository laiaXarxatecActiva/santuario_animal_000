import { faEllipsis } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useId, useRef, useState } from 'react';
import iconStyles from './IconButton.module.css';
import styles from './ActionsMenu.module.css';

export interface ActionsMenuItem {
  label: string;
  onSelect: () => void;
}

interface ActionsMenuProps {
  /** Nombre accesible del botón: «Más acciones de Rufo». */
  label: string;
  items: readonly ActionsMenuItem[];
}

// Menú «⋯» de acciones secundarias (DESIGN_SYSTEM §8.9). Se cierra con Esc
// (devolviendo el foco al botón), al pulsar fuera o al elegir una opción.
export function ActionsMenu({ label, items }: ActionsMenuProps) {
  const [abierto, setAbierto] = useState(false);
  const panelId = useId();
  const raiz = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);

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

  if (items.length === 0) return null;
  return (
    <div ref={raiz} className={styles.menu}>
      <button
        ref={boton}
        type="button"
        className={iconStyles.iconButton}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={panelId}
        onClick={() => setAbierto((a) => !a)}
      >
        <FontAwesomeIcon icon={faEllipsis} aria-hidden="true" />
      </button>
      {abierto && (
        <ul id={panelId} role="menu" aria-label={label} className={styles.panel}>
          {items.map((item) => (
            <li key={item.label} role="none">
              <button
                type="button"
                role="menuitem"
                className={styles.item}
                onClick={() => {
                  setAbierto(false);
                  item.onSelect();
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
