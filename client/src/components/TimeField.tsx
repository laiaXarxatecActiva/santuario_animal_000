import { faPlus, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { FilterSelect } from './FilterSelect';
import { FieldError } from './FormFields';
import fieldStyles from './FormFields.module.css';
import styles from './TimeField.module.css';

const HORAS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'));
const MINUTOS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));
const VACIO = { value: '', label: '--' };

/** Las opciones, con la que ya está elegida aunque no sea de la lista (p. ej., 08:07). */
const opciones = (lista: readonly string[], actual: string) => [
  VACIO,
  ...[...new Set([...lista, ...(actual ? [actual] : [])])].sort().map((v) => ({ value: v, label: v })),
];

/** Hora y minutos sueltos de una hora `HH:MM` (vacíos si no lo es). */
function partes(valor: string): [string, string] {
  const m = /^(\d{2}):(\d{2})$/.exec(valor);
  return m ? [m[1] ?? '', m[2] ?? ''] : ['', ''];
}

interface SelectorProps {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  describedBy?: string;
}

/** Los dos desplegables, «Horas» y «Minutos» (minutos de 5 en 5). */
function Selector({ value, onChange, invalid, describedBy }: SelectorProps) {
  const { t } = useTranslation();
  const [h, m] = partes(value);
  // Elegida la hora sin minutos, los minutos pasan a 00; sin hora, no hay hora.
  const cambiar = (hora: string, minutos: string) => onChange(hora ? `${hora}:${minutos || '00'}` : '');
  return (
    <div className={styles.selector}>
      <FilterSelect
        label={t('time.hours')}
        labelClassName="visually-hidden"
        className={styles.part}
        options={opciones(HORAS, h)}
        value={h}
        onChange={(hora) => cambiar(hora, m)}
        invalid={invalid}
        describedBy={describedBy}
      />
      <span aria-hidden="true">:</span>
      <FilterSelect
        label={t('time.minutes')}
        labelClassName="visually-hidden"
        className={styles.part}
        options={opciones(MINUTOS, m)}
        value={m}
        onChange={(minutos) => cambiar(h || '00', minutos)}
        invalid={invalid}
        describedBy={describedBy}
      />
    </div>
  );
}

interface TimeFieldProps {
  label: string;
  /** `HH:MM`, o vacío si no hay hora. */
  value: string;
  onChange: (value: string) => void;
  error?: string;
  help?: string;
}

/**
 * Campo de hora (DESIGN_SYSTEM §8.5): la hora se elige con dos desplegables, sin
 * escribirla, para no equivocarse con el formato.
 */
export function TimeField({ label, value, onChange, error, help }: TimeFieldProps) {
  const id = useId();
  const describedBy = [help && `${id}-help`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <fieldset className={styles.field}>
      <legend className={fieldStyles.label}>{label}</legend>
      <Selector value={value} onChange={onChange} invalid={Boolean(error)} describedBy={describedBy} />
      {help && (
        <p id={`${id}-help`} className={fieldStyles.help}>
          {help}
        </p>
      )}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </fieldset>
  );
}

interface TimesFieldProps {
  label: string;
  /** Horas `HH:MM`, en orden. */
  value: readonly string[];
  onChange: (value: string[]) => void;
  error?: string;
  help?: string;
}

/** Varias horas (plantillas de tareas, pautas de medicación): cada una con ✕ y «Añadir hora». */
export function TimesField({ label, value, onChange, error, help }: TimesFieldProps) {
  const { t } = useTranslation();
  const id = useId();
  const [nueva, setNueva] = useState('');
  const describedBy = [help && `${id}-help`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  const anadir = () => {
    if (!nueva) return;
    if (!value.includes(nueva)) onChange([...value, nueva].sort());
    setNueva('');
  };
  return (
    <fieldset className={styles.field}>
      <legend className={fieldStyles.label}>{label}</legend>
      {value.length > 0 && (
        <ul className={styles.chips}>
          {value.map((hora) => (
            <li key={hora} className={styles.chip}>
              <span>{hora}</span>
              <button
                type="button"
                className={styles.remove}
                aria-label={t('time.remove', { time: hora })}
                onClick={() => onChange(value.filter((v) => v !== hora))}
              >
                <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.add}>
        <Selector value={nueva} onChange={setNueva} invalid={Boolean(error)} describedBy={describedBy} />
        <Button type="button" variant="outline" icon={faPlus} disabled={!nueva} onClick={anadir}>
          {t('time.add')}
        </Button>
      </div>
      {help && (
        <p id={`${id}-help`} className={fieldStyles.help}>
          {help}
        </p>
      )}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </fieldset>
  );
}
