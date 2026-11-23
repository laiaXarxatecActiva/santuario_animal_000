import { Checkbox, FieldError } from '../FormFields';
import styles from './CheckboxGroup.module.css';

/**
 * Grupo de casillas para elegir varios valores (días de la semana, animales,
 * cualificaciones). Un `fieldset` con su leyenda y el error debajo.
 */
export function CheckboxGroup({
  legend,
  options,
  value,
  onChange,
  error,
  id,
}: {
  legend: string;
  options: { value: number; label: string }[];
  value: number[];
  onChange: (valor: number[]) => void;
  error?: string;
  id: string;
}) {
  const alternar = (opcion: number, marcada: boolean) =>
    onChange(marcada ? [...value, opcion].sort((a, b) => a - b) : value.filter((v) => v !== opcion));
  return (
    <fieldset className={styles.group} aria-describedby={error ? `${id}-error` : undefined}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.options}>
        {options.map((opcion) => (
          <Checkbox
            key={opcion.value}
            label={opcion.label}
            checked={value.includes(opcion.value)}
            onChange={(e) => alternar(opcion.value, e.target.checked)}
          />
        ))}
      </div>
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </fieldset>
  );
}
