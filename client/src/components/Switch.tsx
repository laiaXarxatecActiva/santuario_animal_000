import { useId, useState, type ChangeEvent, type InputHTMLAttributes, type ReactNode, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './Switch.module.css';

interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'role' | 'children'> {
  label: ReactNode;
  help?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

/**
 * Interruptor sí/no para las preferencias (DESIGN_SYSTEM §8.5): una casilla
 * nativa con `role="switch"`, en forma de píldora y con el estado escrito al lado.
 */
export function Switch({ label, help, id, checked, defaultChecked, onChange, className, ...rest }: SwitchProps) {
  const { t } = useTranslation();
  const auto = useId();
  const inputId = id ?? auto;
  const helpId = `${inputId}-help`;
  const [interno, setInterno] = useState(Boolean(defaultChecked));
  const activo = checked ?? interno;

  const alCambiar = (e: ChangeEvent<HTMLInputElement>) => {
    setInterno(e.target.checked);
    onChange?.(e);
  };

  return (
    <div className={`${styles.field} ${className ?? ''}`}>
      <div className={styles.row}>
        <label htmlFor={inputId} className={styles.label}>
          {label}
        </label>
        <span className={styles.control}>
          <input
            id={inputId}
            type="checkbox"
            role="switch"
            className={styles.input}
            checked={checked}
            defaultChecked={checked === undefined ? defaultChecked : undefined}
            onChange={alCambiar}
            aria-describedby={help ? helpId : undefined}
            {...rest}
          />
          <span className={styles.state} aria-hidden="true">
            {activo ? t('form.yes') : t('form.no')}
          </span>
        </span>
      </div>
      {help && (
        <p id={helpId} className={styles.help}>
          {help}
        </p>
      )}
    </div>
  );
}
