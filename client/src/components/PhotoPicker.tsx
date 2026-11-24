import { faCamera, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IMAGE_MAX_BYTES, IMAGE_MIME_TYPES } from '@sanctuary/shared';
import { useEffect, useId, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import buttonStyles from './Button.module.css';
import styles from './PhotoPicker.module.css';

interface PhotoPickerProps {
  /** Leyenda del grupo, p. ej. «Foto (opcional)». */
  label: string;
  value: File | undefined;
  onChange: (file: File | undefined) => void;
  disabled?: boolean;
}

const ACEPTA = IMAGE_MIME_TYPES.join(',');
const esFotoAdmitida = (tipo: string): boolean => (IMAGE_MIME_TYPES as readonly string[]).includes(tipo);

/**
 * Una sola foto opcional (DESIGN_SYSTEM §8.9 «Selector de una foto»): incidencias (CU-70)
 * y tareas completadas (CU-57). Comprueba el formato y el tamaño antes de enviarla; el
 * servidor vuelve a comprobarlos.
 */
export function PhotoPicker({ label, value, onChange, disabled = false }: PhotoPickerProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const ayudaId = useId();
  const [encima, setEncima] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vista, setVista] = useState<string | null>(null);

  // Miniatura de la foto elegida (jsdom no tiene createObjectURL).
  useEffect(() => {
    if (!value || typeof URL.createObjectURL !== 'function') {
      setVista(null);
      return;
    }
    const url = URL.createObjectURL(value);
    setVista(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  const elegir = (archivo: File | undefined) => {
    if (!archivo) return;
    if (!esFotoAdmitida(archivo.type)) {
      setError(t('photoPicker.wrongType'));
      return;
    }
    if (archivo.size > IMAGE_MAX_BYTES) {
      setError(t('photoPicker.tooBig'));
      return;
    }
    setError(null);
    onChange(archivo);
  };

  const soltar = (e: DragEvent<HTMLFieldSetElement>) => {
    e.preventDefault();
    setEncima(false);
    if (!disabled) elegir(e.dataTransfer.files[0]);
  };

  const tamaño = (bytes: number) =>
    bytes < 1024 * 1024
      ? t('photoPicker.kb', { size: Math.max(1, Math.round(bytes / 1024)) })
      : t('photoPicker.mb', { size: (bytes / (1024 * 1024)).toFixed(1) });

  const campo = (
    <input
      id={inputId}
      type="file"
      accept={ACEPTA}
      disabled={disabled}
      aria-describedby={ayudaId}
      className="visually-hidden"
      onChange={(e) => {
        elegir(e.target.files?.[0]);
        e.target.value = '';
      }}
    />
  );

  return (
    <fieldset
      className={`${styles.picker} ${encima ? styles.over : ''} ${value ? styles.chosen : ''}`}
      disabled={disabled}
      onDragOver={(e) => {
        e.preventDefault();
        setEncima(true);
      }}
      onDragLeave={() => setEncima(false)}
      onDrop={soltar}
    >
      <legend className={styles.legend}>{label}</legend>
      {value ? (
        <div className={styles.file}>
          {vista ? (
            <img src={vista} alt="" className={styles.thumb} />
          ) : (
            <span className={styles.thumb} aria-hidden="true">
              <FontAwesomeIcon icon={faCamera} />
            </span>
          )}
          <div className={styles.info}>
            <span className={styles.name}>{value.name}</span>
            <span className={styles.size}>{tamaño(value.size)}</span>
          </div>
          <div className={styles.actions}>
            <label htmlFor={inputId} className={`${buttonStyles.button} ${buttonStyles.outline} ${styles.choose}`}>
              {t('photoPicker.change')}
            </label>
            {campo}
            <button
              type="button"
              className={`${buttonStyles.button} ${buttonStyles.ghost}`}
              onClick={() => {
                setError(null);
                onChange(undefined);
              }}
            >
              <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
              {t('photoPicker.remove')}
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.zone}>
          <FontAwesomeIcon icon={faCamera} aria-hidden="true" className={styles.icon} />
          <p className={styles.drop}>{t('photoPicker.dropHere')}</p>
          <label htmlFor={inputId} className={`${buttonStyles.button} ${buttonStyles.outline} ${styles.choose}`}>
            {t('photoPicker.choose')}
          </label>
          {campo}
        </div>
      )}
      <p id={ayudaId} className={styles.help}>
        {t('photoPicker.help')}
      </p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
