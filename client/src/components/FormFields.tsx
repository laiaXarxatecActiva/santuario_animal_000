import { faCircleExclamation, faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { useTranslation } from 'react-i18next';
import styles from './FormFields.module.css';

// Campos de formulario (DESIGN_SYSTEM §8.5): etiqueta siempre visible, ayuda y
// error debajo, enlazados con aria-describedby. Funcionan con `register()` de react-hook-form.

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'children'> {
  label: string;
  error?: string;
  help?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className={styles.error}>
      <FontAwesomeIcon icon={faCircleExclamation} aria-hidden="true" /> {children}
    </p>
  );
}

function useIds(id: string | undefined, help: unknown, error: unknown) {
  const auto = useId();
  const inputId = id ?? auto;
  const helpId = `${inputId}-help`;
  const errorId = `${inputId}-error`;
  const describedBy = [help ? helpId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined;
  return { inputId, helpId, errorId, describedBy };
}

function Field({ label, error, help, id, className, adornment, ...rest }: FieldProps & { adornment?: ReactNode }) {
  const { inputId, helpId, errorId, describedBy } = useIds(id, help, error);
  return (
    <div className={`${styles.field} ${className ?? ''}`}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <div className={styles.control}>
        <input
          id={inputId}
          className={`${styles.input} ${adornment ? styles.withAdornment : ''}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
        {adornment}
      </div>
      {help && (
        <p id={helpId} className={styles.help}>
          {help}
        </p>
      )}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}

export function TextField(props: FieldProps) {
  return <Field type="text" {...props} />;
}

/** Contraseña con el botón para mostrarla u ocultarla. */
export function PasswordField(props: Omit<FieldProps, 'type'>) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  return (
    <Field
      {...props}
      type={visible ? 'text' : 'password'}
      adornment={
        <button
          type="button"
          className={styles.reveal}
          aria-label={visible ? t('form.hidePassword') : t('form.showPassword')}
          onClick={() => setVisible((v) => !v)}
        >
          <FontAwesomeIcon icon={visible ? faEyeSlash : faEye} aria-hidden="true" />
        </button>
      }
    />
  );
}

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'> {
  label: ReactNode;
  error?: string;
  ref?: Ref<HTMLInputElement>;
}

/** Casilla nativa con zona pulsable de 44 px que incluye la etiqueta. */
export function Checkbox({ label, error, id, ...rest }: CheckboxProps) {
  const { inputId, errorId, describedBy } = useIds(id, undefined, error);
  return (
    <div className={styles.field}>
      <div className={styles.checkbox}>
        <input
          id={inputId}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
        <label htmlFor={inputId}>{label}</label>
      </div>
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  help?: ReactNode;
  ref?: Ref<HTMLSelectElement>;
}

/** Desplegable nativo con el mismo aspecto que los campos de texto. */
export function SelectField({ label, error, help, id, className, children, ...rest }: SelectFieldProps) {
  const { inputId, helpId, errorId, describedBy } = useIds(id, help, error);
  return (
    <div className={`${styles.field} ${className ?? ''}`}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <select
        id={inputId}
        className={`${styles.input} ${styles.select}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      >
        {children}
      </select>
      {help && (
        <p id={helpId} className={styles.help}>
          {help}
        </p>
      )}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  help?: ReactNode;
  ref?: Ref<HTMLTextAreaElement>;
}

/** Área de texto: al menos 6 líneas, con ajuste vertical (DESIGN_SYSTEM §8.5). */
export function TextAreaField({ label, error, help, id, className, rows = 6, ...rest }: TextAreaFieldProps) {
  const { inputId, helpId, errorId, describedBy } = useIds(id, help, error);
  return (
    <div className={`${styles.field} ${className ?? ''}`}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <textarea
        id={inputId}
        rows={rows}
        className={`${styles.input} ${styles.textarea}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      {help && (
        <p id={helpId} className={styles.help}>
          {help}
        </p>
      )}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}
