import { faCheck, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import styles from './FilterSelect.module.css';

export interface FilterOption<T extends string> {
  value: T;
  label: string;
  /** Se ve, pero no se puede elegir (como `<option disabled>`). */
  disabled?: boolean;
}

interface PropsComunes<T extends string> {
  label: string;
  options: readonly FilterOption<T>[];
  /** Clase del contenedor (etiqueta + desplegable). */
  className?: string;
  labelClassName?: string;
  /** Para los formularios (`SelectField`): id del botón, desactivado, error y descripción. */
  id?: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  onBlur?: () => void;
}

interface PropsUna<T extends string> extends PropsComunes<T> {
  multiple?: false;
  value: T;
  onChange: (value: T) => void;
}

/** Varias opciones a la vez (CU-02: varias especies o tramos de edad). */
interface PropsVarias<T extends string> extends PropsComunes<T> {
  multiple: true;
  value: readonly T[];
  onChange: (value: T[]) => void;
  /** Primera opción, que desmarca las demás («Todas las especies»). */
  allLabel: string;
  /** Texto del botón con dos o más marcadas («2 especies»). */
  summary: (count: number) => string;
}

type FilterSelectProps<T extends string> = PropsUna<T> | PropsVarias<T>;

/**
 * Desplegable de la web (DESIGN_SYSTEM §8.5): lo usan los filtros y, a través de
 * `SelectField`, todos los formularios, para que todos se vean igual. Sustituye al
 * `<select>` nativo, cuya lista abierta no se puede colorear ni animar, por el
 * mismo panel que el selector de idioma. Sigue el patrón «combobox de solo
 * selección» de WAI-ARIA: el foco se queda en el botón y la opción activa se
 * indica con `aria-activedescendant`. Con `multiple`, cada opción lleva una
 * casilla, la lista sigue abierta al marcar y la primera opción («Todas…»)
 * desmarca las demás.
 */
export function FilterSelect<T extends string>(props: FilterSelectProps<T>) {
  const { label, options, className, labelClassName, disabled, invalid, describedBy, onBlur } = props;
  const [abierto, setAbierto] = useState(false);
  const [activa, setActiva] = useState(0);
  const id = useId();
  const botonId = props.id ?? `${id}-boton`;
  const etiquetaId = `${id}-etiqueta`;
  const panelId = `${id}-lista`;
  const opcionId = (i: number) => `${id}-opcion-${i}`;
  const raiz = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);

  // En modo «varias», la posición 0 es «Todas…» y las opciones van detrás.
  const filas: { label: string; value: string; marcada: boolean; disabled?: boolean }[] = props.multiple
    ? [
        { label: props.allLabel, value: '', marcada: props.value.length === 0 },
        ...options.map((o) => ({
          label: o.label,
          value: o.value,
          marcada: props.value.includes(o.value),
          disabled: o.disabled,
        })),
      ]
    : options.map((o) => ({ label: o.label, value: o.value, marcada: o.value === props.value, disabled: o.disabled }));

  const elegida = Math.max(
    0,
    filas.findIndex((f) => f.marcada),
  );

  let textoBoton = filas[elegida]?.label;
  if (props.multiple && props.value.length > 1) textoBoton = props.summary(props.value.length);

  const abrir = () => {
    setActiva(props.multiple ? 0 : elegida);
    setAbierto(true);
  };

  const cerrar = () => {
    setAbierto(false);
    boton.current?.focus();
  };

  const elegir = (i: number) => {
    if (filas[i]?.disabled) return;
    if (props.multiple) {
      // Marca o desmarca sin cerrar; «Todas…» las desmarca todas.
      const opcion = options[i - 1];
      if (!opcion) {
        if (props.value.length) props.onChange([]);
        return;
      }
      props.onChange(
        props.value.includes(opcion.value)
          ? props.value.filter((v) => v !== opcion.value)
          : [...props.value, opcion.value],
      );
      return;
    }
    const opcion = options[i];
    cerrar();
    if (opcion && opcion.value !== props.value) props.onChange(opcion.value);
  };

  // Se cierra al pulsar fuera.
  useEffect(() => {
    if (!abierto) return;
    const alPulsarFuera = (e: MouseEvent) => {
      if (e.target instanceof Node && !raiz.current?.contains(e.target)) setAbierto(false);
    };
    document.addEventListener('mousedown', alPulsarFuera);
    return () => document.removeEventListener('mousedown', alPulsarFuera);
  }, [abierto]);

  const alPulsarTecla = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!abierto) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        abrir();
      }
      return;
    }
    // Las flechas, Inicio y Fin saltan las opciones desactivadas.
    const elegibles = filas.flatMap((f, i) => (f.disabled ? [] : [i]));
    const mover: Record<string, number> = {
      ArrowDown: elegibles.find((i) => i > activa) ?? activa,
      ArrowUp: elegibles.findLast((i) => i < activa) ?? activa,
      Home: elegibles[0] ?? activa,
      End: elegibles.at(-1) ?? activa,
    };
    if (e.key in mover) {
      e.preventDefault();
      setActiva(mover[e.key]!);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      elegir(activa);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cerrar();
    } else if (e.key === 'Tab') {
      setAbierto(false);
    }
  };

  return (
    <div ref={raiz} className={className}>
      <label id={etiquetaId} htmlFor={botonId} className={labelClassName}>
        {label}
      </label>
      <div className={styles.wrapper}>
        <button
          ref={boton}
          id={botonId}
          type="button"
          role="combobox"
          className={styles.button}
          aria-labelledby={etiquetaId}
          aria-haspopup="listbox"
          aria-expanded={abierto}
          aria-controls={panelId}
          aria-activedescendant={abierto ? opcionId(activa) : undefined}
          // El valor elegido, como en un <select> (en «varias», separados por comas).
          value={props.multiple ? props.value.join(',') : props.value}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          disabled={disabled}
          onClick={() => (abierto ? setAbierto(false) : abrir())}
          onKeyDown={alPulsarTecla}
          onBlur={onBlur}
        >
          <span className={styles.value}>{textoBoton}</span>
          <FontAwesomeIcon icon={faChevronDown} aria-hidden="true" className={styles.chevron} />
        </button>
        <ul
          id={panelId}
          role="listbox"
          // Solo abierta lleva el nombre de la etiqueta: cerrada no hace falta, y así la
          // etiqueta nombra un único elemento (el botón).
          aria-labelledby={abierto ? etiquetaId : undefined}
          aria-multiselectable={props.multiple || undefined}
          className={`${styles.panel} dropdown-panel`}
          hidden={!abierto}
        >
          {filas.map((fila, i) => (
            <li
              key={i}
              id={opcionId(i)}
              role="option"
              aria-selected={fila.marcada}
              aria-disabled={fila.disabled || undefined}
              data-value={fila.value}
              className={styles.option}
              data-active={i === activa}
              // Evita que el botón pierda el foco al pulsar la opción.
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActiva(i)}
              onClick={() => elegir(i)}
            >
              {props.multiple && (
                <span className={styles.box} aria-hidden="true">
                  {fila.marcada && <FontAwesomeIcon icon={faCheck} />}
                </span>
              )}
              {fila.label}
              {!props.multiple && fila.marcada && (
                <FontAwesomeIcon icon={faCheck} aria-hidden="true" className={styles.check} />
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
