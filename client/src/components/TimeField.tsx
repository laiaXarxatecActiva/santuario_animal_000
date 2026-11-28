import { faPlus, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useId, useState, type InputHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { FieldError } from './FormFields';
import fieldStyles from './FormFields.module.css';
import styles from './TimeField.module.css';

/**
 * El campo de hora del navegador (`<input type="time">`): en móvil abre el selector
 * del sistema y en el ordenador se teclea por partes (hora y minutos), sin poder
 * escribir una hora imposible. El valor es `HH:MM` o vacío.
 */
function CampoHora(
  props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
    value: string;
    onChange: (value: string) => void;
  },
) {
  const { value, onChange, className, ...rest } = props;
  return (
    <input
      type="time"
      className={`${fieldStyles.input} ${styles.time} ${className ?? ''}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      {...rest}
    />
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

/** Campo de una hora (DESIGN_SYSTEM §8.5), con su etiqueta, ayuda y error. */
export function TimeField({ label, value, onChange, error, help }: TimeFieldProps) {
  const id = useId();
  const describedBy = [help && `${id}-help`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={fieldStyles.label}>
        {label}
      </label>
      <CampoHora
        id={id}
        value={value}
        onChange={onChange}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      {help && (
        <p id={`${id}-help`} className={fieldStyles.help}>
          {help}
        </p>
      )}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
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

/** Varias horas (plantillas de tareas, pautas de medicación): cada una con ✕, y «Nueva hora» con «Añadir hora». */
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
        <label htmlFor={`${id}-nueva`} className="visually-hidden">
          {t('time.new')}
        </label>
        <CampoHora
          id={`${id}-nueva`}
          value={nueva}
          onChange={setNueva}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          // Intro añade la hora en lugar de enviar el formulario.
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              anadir();
            }
          }}
        />
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
