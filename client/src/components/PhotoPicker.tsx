import { faCamera, faPlus, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IMAGE_MAX_BYTES, IMAGE_MIME_TYPES } from '@sanctuary/shared';
import { useEffect, useId, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import buttonStyles from './Button.module.css';
import styles from './PhotoPicker.module.css';

interface PhotoPickerProps {
  /** Leyenda del grupo, p. ej. «Fotos (opcional)». */
  label: string;
  value: readonly File[];
  onChange: (files: File[]) => void;
  /** Cuántas fotos como mucho. */
  max: number;
  disabled?: boolean;
}

const ACEPTA = IMAGE_MIME_TYPES.join(',');
const esFotoAdmitida = (tipo: string): boolean => (IMAGE_MIME_TYPES as readonly string[]).includes(tipo);

/** Miniatura de una foto elegida (jsdom no tiene createObjectURL). */
function Miniatura({ archivo }: { archivo: File }) {
  const [vista, setVista] = useState<string | null>(null);
  useEffect(() => {
    if (typeof URL.createObjectURL !== 'function') return;
    const url = URL.createObjectURL(archivo);
    setVista(url);
    return () => URL.revokeObjectURL(url);
  }, [archivo]);
  return vista ? (
    <img src={vista} alt="" className={styles.thumb} />
  ) : (
    <span className={styles.thumb} aria-hidden="true">
      <FontAwesomeIcon icon={faCamera} />
    </span>
  );
}

/**
 * Varias fotos opcionales (DESIGN_SYSTEM §8.9 «Selector de fotos»): incidencias
 * (CU-70). Comprueba el formato, el tamaño y el máximo antes de enviarlas; el
 * servidor vuelve a comprobarlos.
 */
export function PhotoPicker({ label, value, onChange, max, disabled = false }: PhotoPickerProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const ayudaId = useId();
  const listaId = useId();
  const [encima, setEncima] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Añade las admitidas hasta el máximo; avisa de la primera que sobra o no vale. */
  const añadir = (archivos: readonly File[]) => {
    const nuevas: File[] = [];
    let aviso: string | null = null;
    for (const archivo of archivos) {
      if (!esFotoAdmitida(archivo.type)) aviso ??= t('photoPicker.wrongType');
      else if (archivo.size > IMAGE_MAX_BYTES) aviso ??= t('photoPicker.tooBig');
      else if (value.length + nuevas.length >= max) aviso ??= t('photoPicker.tooMany', { count: max });
      else nuevas.push(archivo);
    }
    setError(aviso);
    if (nuevas.length > 0) onChange([...value, ...nuevas]);
  };

  const soltar = (e: DragEvent<HTMLFieldSetElement>) => {
    e.preventDefault();
    setEncima(false);
    if (!disabled) añadir(Array.from(e.dataTransfer.files));
  };

  const tamaño = (bytes: number) =>
    bytes < 1024 * 1024
      ? t('photoPicker.kb', { size: Math.max(1, Math.round(bytes / 1024)) })
      : t('photoPicker.mb', { size: (bytes / (1024 * 1024)).toFixed(1) });

  const hayFotos = value.length > 0;
  const caben = value.length < max;

  const campo = (
    <input
      id={inputId}
      type="file"
      multiple
      accept={ACEPTA}
      disabled={disabled}
      aria-describedby={ayudaId}
      className="visually-hidden"
      onChange={(e) => {
        añadir(Array.from(e.target.files ?? []));
        e.target.value = '';
      }}
    />
  );

  return (
    <fieldset
      className={`${styles.picker} ${encima ? styles.over : ''}`}
      disabled={disabled}
      onDragOver={(e) => {
        e.preventDefault();
        setEncima(true);
      }}
      onDragLeave={() => setEncima(false)}
      onDrop={soltar}
    >
      <legend className={styles.legend}>{label}</legend>
      {hayFotos && (
        <ul id={listaId} aria-label={t('photoPicker.chosen')} className={styles.list}>
          {value.map((archivo, i) => (
            <li key={`${archivo.name}-${i}`} className={styles.file}>
              <Miniatura archivo={archivo} />
              <div className={styles.info}>
                <span className={styles.name}>{archivo.name}</span>
                <span className={styles.size}>{tamaño(archivo.size)}</span>
              </div>
              <button
                type="button"
                className={`${buttonStyles.button} ${buttonStyles.ghost} ${styles.remove}`}
                aria-label={t('photoPicker.removeOne', { name: archivo.name })}
                onClick={() => {
                  setError(null);
                  onChange(value.filter((_, j) => j !== i));
                }}
              >
                <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
                <span aria-hidden="true">{t('photoPicker.remove')}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!hayFotos ? (
        <div className={styles.zone}>
          <FontAwesomeIcon icon={faCamera} aria-hidden="true" className={styles.icon} />
          <p className={styles.drop}>{t('photoPicker.dropHere')}</p>
          <label htmlFor={inputId} className={`${buttonStyles.button} ${buttonStyles.outline} ${styles.choose}`}>
            {t('photoPicker.choose')}
          </label>
          {campo}
        </div>
      ) : (
        caben && (
          <div className={styles.more}>
            <label htmlFor={inputId} className={`${buttonStyles.button} ${buttonStyles.outline} ${styles.choose}`}>
              <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
              {t('photoPicker.add')}
            </label>
            {campo}
          </div>
        )
      )}
      <p id={ayudaId} className={styles.help}>
        {t('photoPicker.help', { count: max })}
      </p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
