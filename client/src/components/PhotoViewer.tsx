import { faChevronLeft, faChevronRight, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { PhotoDto } from '@sanctuary/shared';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import iconStyles from './IconButton.module.css';
import styles from './PhotoViewer.module.css';

interface PhotoViewerProps {
  photos: PhotoDto[];
  /** Posición de la foto con la que se abre. */
  start: number;
  /** Nombre accesible del visor (p. ej., «Fotos de Rufo»). */
  title: string;
  onClose: () => void;
}

// Visor de fotos a pantalla completa (DESIGN_SYSTEM §8.4): <dialog> nativo,
// flechas laterales (también con el teclado) y contador «3 de 8».
export function PhotoViewer({ photos, start, title, onClose }: PhotoViewerProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const [actual, setActual] = useState(() => Math.min(Math.max(start, 0), photos.length - 1));
  const foto = photos[actual];
  const varias = photos.length > 1;

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    dialogo.showModal();
    return () => dialogo.close();
  }, []);

  const ir = (paso: number) => setActual((i) => Math.min(Math.max(i + paso, 0), photos.length - 1));

  return (
    <dialog
      ref={ref}
      className={styles.viewer}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') ir(1);
        else if (e.key === 'ArrowLeft') ir(-1);
      }}
    >
      <div className={styles.top}>
        {varias && <p className={styles.counter}>{t('viewer.counter', { n: actual + 1, total: photos.length })}</p>}
        <button
          type="button"
          className={`${iconStyles.iconButton} ${styles.button}`}
          aria-label={t('modal.close')}
          onClick={onClose}
        >
          <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
        </button>
      </div>

      <div className={styles.stage}>
        {varias && (
          <button
            type="button"
            className={`${iconStyles.iconButton} ${styles.button}`}
            aria-label={t('viewer.previous')}
            disabled={actual === 0}
            onClick={() => ir(-1)}
          >
            <FontAwesomeIcon icon={faChevronLeft} aria-hidden="true" />
          </button>
        )}
        {foto &&
          (foto.mediaType === 'video' ? (
            <video key={foto.id} src={foto.url} controls muted className={styles.media} aria-label={foto.altText} />
          ) : (
            <img key={foto.id} src={foto.url} alt={foto.altText} className={styles.media} />
          ))}
        {varias && (
          <button
            type="button"
            className={`${iconStyles.iconButton} ${styles.button}`}
            aria-label={t('viewer.next')}
            disabled={actual === photos.length - 1}
            onClick={() => ir(1)}
          >
            <FontAwesomeIcon icon={faChevronRight} aria-hidden="true" />
          </button>
        )}
      </div>
    </dialog>
  );
}
