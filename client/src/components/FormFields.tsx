import { faCircleExclamation, faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { isLanguage } from '@sanctuary/shared';
import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { useTranslation } from 'react-i18next';
import { traducirMensaje } from '../i18n/mensajesValidacion';
import { FilterSelect, type FilterOption } from './FilterSelect';
import styles from './FormFields.module.css';

// Campos de formulario (DESIGN_SYSTEM §8.5): etiqueta siempre visible, ayuda y
// error debajo, enlazados con aria-describedby. Funcionan con `register()` de react-hook-form.

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'children'> {
  label: string;
  error?: string;
  help?: ReactNode;
  /** Insignia junto a la etiqueta (p. ej. «Modificado»); también forma parte de la descripción. */
  badge?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  // Fase 3: los mensajes de los esquemas y del servidor llegan en castellano.
  const { i18n } = useTranslation();
  const idioma = isLanguage(i18n.language) ? i18n.language : 'es';
  return (
    <p id={id} className={styles.error}>
      <FontAwesomeIcon icon={faCircleExclamation} aria-hidden="true" />{' '}
      {typeof children === 'string' ? traducirMensaje(children, idioma) : children}
    </p>
  );
}

function useIds(id: string | undefined, help: unknown, error: unknown, badge?: unknown) {
  const auto = useId();
  const inputId = id ?? auto;
  const helpId = `${inputId}-help`;
  const errorId = `${inputId}-error`;
  const badgeId = `${inputId}-badge`;
  const describedBy =
    [badge ? badgeId : '', help ? helpId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined;
  return { inputId, helpId, errorId, badgeId, describedBy };
}

function Field({
  label,
  error,
  help,
  badge,
  id,
  className,
  adornment,
  ...rest
}: FieldProps & { adornment?: ReactNode }) {
  const { inputId, helpId, errorId, badgeId, describedBy } = useIds(id, help, error, badge);
  return (
    <div className={`${styles.field} ${className ?? ''}`}>
      <div className={styles.labelRow}>
        <label htmlFor={inputId} className={styles.label}>
          {label}
        </label>
        {badge && <span id={badgeId}>{badge}</span>}
      </div>
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

/**
 * Desplegable de los formularios: se escribe como un `<select>` (con sus `<option>`
 * y `register()` de react-hook-form o `value`/`onChange`), pero se ve y se usa como
 * los filtros de Animales (`FilterSelect`, DESIGN_SYSTEM §8.5). El `<select>` sigue
 * en la página, oculto, y guarda el valor: al elegir una opción se le cambia y se
 * avisa con su evento `change`, así que el formulario no nota la diferencia.
 */
export function SelectField({ label, error, help, id, className, children, ref, disabled, ...rest }: SelectFieldProps) {
  const { inputId, helpId, errorId, describedBy } = useIds(id, help, error);
  const select = useRef<HTMLSelectElement | null>(null);
  const [opciones, setOpciones] = useState<FilterOption<string>[]>([]);
  const [valor, setValor] = useState('');

  // Las opciones y el valor se leen del <select> tras cada render (así valen
  // `<option>` sueltas, listas y fragmentos, y los cambios de `reset()`).
  const leer = useCallback(() => {
    const campo = select.current;
    if (!campo) return;
    const nuevas = Array.from(campo.options, (o) => ({ value: o.value, label: o.text, disabled: o.disabled }));
    setOpciones((antes) => (mismasOpciones(antes, nuevas) ? antes : nuevas));
    setValor(campo.value);
  }, []);
  useLayoutEffect(leer);

  const unirRef = useCallback(
    (campo: HTMLSelectElement | null) => {
      select.current = campo;
      if (typeof ref === 'function') ref(campo);
      else if (ref) ref.current = campo;
    },
    [ref],
  );

  const elegir = (nuevo: string) => {
    const campo = select.current;
    if (!campo) return;
    campo.value = nuevo;
    campo.dispatchEvent(new Event('change', { bubbles: true }));
    leer();
  };

  // react-hook-form marca el campo como tocado con el `blur` del <select>.
  const alSalir = () => select.current?.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));

  return (
    <div className={`${styles.field} ${className ?? ''}`}>
      <FilterSelect
        id={inputId}
        label={label}
        labelClassName={styles.label}
        className={styles.select}
        options={opciones}
        value={valor}
        onChange={elegir}
        onBlur={alSalir}
        disabled={disabled}
        invalid={Boolean(error)}
        describedBy={describedBy}
      />
      <select ref={unirRef} hidden tabIndex={-1} aria-hidden="true" disabled={disabled} {...rest}>
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

const mismasOpciones = (a: readonly FilterOption<string>[], b: readonly FilterOption<string>[]) =>
  a.length === b.length &&
  a.every((o, i) => o.value === b[i]!.value && o.label === b[i]!.label && o.disabled === b[i]!.disabled);

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

interface RadioGroupProps<T extends string> {
  legend: string;
  name: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** Botones de opción nativos agrupados (DESIGN_SYSTEM §8.5), con zona pulsable de 44 px. */
export function RadioGroup<T extends string>({ legend, name, options, value, onChange }: RadioGroupProps<T>) {
  const base = useId();
  return (
    <fieldset className={styles.radioGroup}>
      <legend className={styles.label}>{legend}</legend>
      {options.map((opcion) => {
        const id = `${base}-${opcion.value}`;
        return (
          <div key={opcion.value} className={styles.checkbox}>
            <input
              id={id}
              type="radio"
              name={name}
              value={opcion.value}
              checked={value === opcion.value}
              onChange={() => onChange(opcion.value)}
            />
            <label htmlFor={id}>{opcion.label}</label>
          </div>
        );
      })}
    </fieldset>
  );
}

/**
 * Campo dentro de una frase (DESIGN_SYSTEM §8.5): «Avisar si un animal come poco en
 * [2 ▼] comidas seguidas». El texto de alrededor se ve pero no se lee dos veces: el
 * campo lleva su propia etiqueta (oculta), y la ayuda y el error van debajo de la frase.
 */
export function InlineField({
  before,
  after,
  help,
  error,
  children,
}: {
  before: string;
  after: string;
  help?: ReactNode;
  error?: string;
  children: (campo: { describedBy: string | undefined; invalid: boolean }) => ReactNode;
}) {
  const { helpId, errorId, describedBy } = useIds(undefined, help, error);
  return (
    <div className={styles.field}>
      <div className={styles.phrase}>
        <span aria-hidden="true">{before}</span>
        {children({ describedBy, invalid: Boolean(error) })}
        <span aria-hidden="true">{after}</span>
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

/** Número corto dentro de una frase (`InlineField`), con su etiqueta en `aria-label`. */
export function InlineNumberInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string }) {
  const { label, className, ...rest } = props;
  return (
    <input
      type="number"
      aria-label={label}
      className={`${styles.input} ${styles.inlineInput} ${className ?? ''}`}
      {...rest}
    />
  );
}

/** Desplegable corto dentro de una frase (`InlineField`), con su etiqueta oculta. */
export function InlineSelect<T extends string>({
  label,
  options,
  value,
  onChange,
  describedBy,
  invalid,
}: {
  label: string;
  options: readonly FilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
  describedBy?: string;
  invalid?: boolean;
}) {
  return (
    <FilterSelect
      label={label}
      labelClassName="visually-hidden"
      className={styles.inlineSelect}
      options={options}
      value={value}
      onChange={onChange}
      describedBy={describedBy}
      invalid={invalid}
    />
  );
}
