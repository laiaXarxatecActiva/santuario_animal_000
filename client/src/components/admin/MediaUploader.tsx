import { faCamera, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  IMAGE_MIME_TYPES,
  MAX_FILES_PER_UPLOAD,
  VIDEO_MIME_TYPES,
  VISIBILITIES,
  photoMetaSchema,
  type Visibility,
} from '@sanctuary/shared';
import { useId, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '../Alert';
import buttonStyles from '../Button.module.css';
import { SelectField, TextField } from '../FormFields';
import iconStyles from '../IconButton.module.css';
import styles from './MediaUploader.module.css';

/** Archivo elegido que todavía no se ha subido. */
export interface PendingMedia {
  id: string;
  file: File;
  altText: string;
  visibility: Visibility;
  /** Error de validación del texto alternativo. */
  error?: string;
}

const ACEPTA = [...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES].join(',');
let contador = 0;

const sinError = ({ error: _error, ...resto }: PendingMedia): PendingMedia => resto;

/** CU-29 3a: marca los archivos sin texto alternativo (con el mismo esquema que el servidor). */
export function validarPendientes(items: PendingMedia[]): { items: PendingMedia[]; ok: boolean } {
  let ok = true;
  const validados = items.map((item) => {
    const resultado = photoMetaSchema.safeParse({ altText: item.altText, visibility: item.visibility });
    const limpio = sinError(item);
    if (resultado.success) return limpio;
    ok = false;
    return { ...limpio, error: resultado.error.issues[0]?.message ?? '' };
  });
  return { items: validados, ok };
}

interface MediaUploaderProps {
  items: PendingMedia[];
  onChange: (items: PendingMedia[]) => void;
  /** Visibilidad por archivo (la galería); las fotos de una actualización usan la de la actualización. */
  showVisibility?: boolean;
  disabled?: boolean;
}

// Zona de subida de fotos y vídeos (DESIGN_SYSTEM §8.9, CU-29 pasos 2-3). Los
// formatos y tamaños los comprueba el servidor, que rechaza archivo a archivo.
export function MediaUploader({ items, onChange, showVisibility = true, disabled = false }: MediaUploaderProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const ayudaId = useId();
  const [encima, setEncima] = useState(false);
  const [demasiados, setDemasiados] = useState(false);

  const añadir = (archivos: FileList | readonly File[]) => {
    const lista = Array.from(archivos);
    const hueco = Math.max(MAX_FILES_PER_UPLOAD - items.length, 0);
    setDemasiados(lista.length > hueco);
    const nuevos = lista
      .slice(0, hueco)
      .map((file): PendingMedia => ({ id: String(++contador), file, altText: '', visibility: 'public' }));
    if (nuevos.length > 0) onChange([...items, ...nuevos]);
  };

  const cambiar = (id: string, cambios: Partial<Pick<PendingMedia, 'altText' | 'visibility'>>) =>
    onChange(items.map((item) => (item.id === id ? { ...sinError(item), ...cambios } : item)));

  const quitar = (id: string) => {
    setDemasiados(false);
    onChange(items.filter((item) => item.id !== id));
  };

  const soltar = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setEncima(false);
    if (!disabled) añadir(e.dataTransfer.files);
  };

  return (
    <div className={styles.uploader}>
      <div
        className={`${styles.zone} ${encima ? styles.over : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setEncima(true);
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={soltar}
      >
        <FontAwesomeIcon icon={faCamera} aria-hidden="true" className={styles.icon} />
        <p>{t('admin.media.dropHere')}</p>
        <label htmlFor={inputId} className={`${buttonStyles.button} ${buttonStyles.outline} ${styles.choose}`}>
          {t('admin.media.choose')}
        </label>
        <input
          id={inputId}
          type="file"
          multiple
          accept={ACEPTA}
          disabled={disabled}
          aria-describedby={ayudaId}
          className="visually-hidden"
          onChange={(e) => {
            if (e.target.files) añadir(e.target.files);
            e.target.value = '';
          }}
        />
        <p id={ayudaId} className={styles.help}>
          {t('admin.media.help')}
        </p>
      </div>

      {demasiados && <Alert type="warning">{t('admin.media.tooMany')}</Alert>}

      {items.length > 0 && (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id}>
              <fieldset className={styles.item}>
                <legend className={styles.fileName}>{item.file.name}</legend>
                <TextField
                  label={t('admin.media.altText')}
                  value={item.altText}
                  maxLength={300}
                  disabled={disabled}
                  error={item.error}
                  onChange={(e) => cambiar(item.id, { altText: e.target.value })}
                />
                {showVisibility && (
                  <SelectField
                    label={t('admin.media.visibility')}
                    value={item.visibility}
                    disabled={disabled}
                    onChange={(e) => cambiar(item.id, { visibility: e.target.value as Visibility })}
                  >
                    {VISIBILITIES.map((v) => (
                      <option key={v} value={v}>
                        {t(`admin.media.visibility_${v}`)}
                      </option>
                    ))}
                  </SelectField>
                )}
                <button
                  type="button"
                  className={`${iconStyles.iconButton} ${styles.remove}`}
                  aria-label={t('admin.media.remove', { name: item.file.name })}
                  disabled={disabled}
                  onClick={() => quitar(item.id)}
                >
                  <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
                </button>
              </fieldset>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
