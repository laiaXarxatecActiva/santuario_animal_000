import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faArrowDown, faArrowUp, faPen, faStar, faTrashCan, faVideo } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { AdminPhotoDto } from '@sanctuary/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimalPhoto } from '../AnimalPhoto';
import { Badge } from '../Badge';
import iconStyles from '../IconButton.module.css';
import styles from './PhotoGrid.module.css';

interface PhotoGridProps {
  photos: AdminPhotoDto[];
  /** Nuevo orden completo de la galería. */
  onReorder: (photoIds: number[]) => void;
  onSetCover: (photo: AdminPhotoDto) => void;
  onEdit: (photo: AdminPhotoDto) => void;
  onDelete: (photo: AdminPhotoDto) => void;
  disabled?: boolean;
}

/** Mueve el elemento de `desde` a la posición `hasta`. */
function mover<T>(lista: readonly T[], desde: number, hasta: number): T[] {
  const copia = [...lista];
  const [elemento] = copia.splice(desde, 1);
  if (elemento !== undefined) copia.splice(hasta, 0, elemento);
  return copia;
}

function Accion({
  icon,
  label,
  onClick,
  disabled,
  pressed,
}: {
  icon: IconDefinition;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      className={`${iconStyles.iconButton} ${styles.action}`}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
    >
      <FontAwesomeIcon icon={icon} aria-hidden="true" />
    </button>
  );
}

// Cuadrícula de fotos del panel (DESIGN_SYSTEM §8.9, CU-29 pasos 5-6, A1 y
// A2). Se ordena arrastrando o con los botones subir y bajar (móvil y teclado).
// Solo oculta interfaz: el servidor comprueba qué puede ser portada.
export function PhotoGrid({ photos, onReorder, onSetCover, onEdit, onDelete, disabled = false }: PhotoGridProps) {
  const { t } = useTranslation();
  const [arrastrada, setArrastrada] = useState<number | null>(null);
  const ids = photos.map((p) => p.id);

  const reordenar = (desde: number, hasta: number) => {
    if (desde === hasta || hasta < 0 || hasta >= ids.length) return;
    onReorder(mover(ids, desde, hasta));
  };

  return (
    <ul className={styles.grid} aria-label={t('admin.photos.gallery')}>
      {photos.map((photo, i) => {
        const nombre = photo.altText;
        const puedeSerPortada = photo.mediaType === 'image' && photo.visibility === 'public';
        return (
          <li
            key={photo.id}
            className={`${styles.item} ${arrastrada === i ? styles.dragging : ''}`}
            draggable={!disabled}
            onDragStart={() => setArrastrada(i)}
            onDragEnd={() => setArrastrada(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (arrastrada !== null) reordenar(arrastrada, i);
              setArrastrada(null);
            }}
          >
            <AnimalPhoto photo={photo} thumbnail ratio="1/1" />
            <div className={styles.badges}>
              {photo.isCover && <Badge tone="primary">{t('admin.photos.cover')}</Badge>}
              <Badge tone={photo.visibility === 'public' ? 'neutral' : 'info'}>
                {t(`admin.media.visibility_${photo.visibility}`)}
              </Badge>
              {photo.mediaType === 'video' && (
                <Badge tone="neutral" icon={faVideo}>
                  {t('admin.photos.video')}
                </Badge>
              )}
            </div>
            <div className={styles.actions}>
              <Accion
                icon={faStar}
                label={
                  photo.isCover
                    ? t('admin.photos.isCover', { name: nombre })
                    : t('admin.photos.setCover', { name: nombre })
                }
                pressed={photo.isCover}
                disabled={disabled || photo.isCover || !puedeSerPortada}
                onClick={() => onSetCover(photo)}
              />
              <Accion
                icon={faArrowUp}
                label={t('admin.photos.moveUp', { name: nombre })}
                disabled={disabled || i === 0}
                onClick={() => reordenar(i, i - 1)}
              />
              <Accion
                icon={faArrowDown}
                label={t('admin.photos.moveDown', { name: nombre })}
                disabled={disabled || i === photos.length - 1}
                onClick={() => reordenar(i, i + 1)}
              />
              <Accion
                icon={faPen}
                label={t('admin.common.edit', { name: nombre })}
                disabled={disabled}
                onClick={() => onEdit(photo)}
              />
              <Accion
                icon={faTrashCan}
                label={t('admin.common.deleteNamed', { name: nombre })}
                disabled={disabled}
                onClick={() => onDelete(photo)}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
