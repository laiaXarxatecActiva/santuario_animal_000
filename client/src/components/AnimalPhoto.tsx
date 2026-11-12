import { faFeather } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { PhotoDto } from '@sanctuary/shared';
import { useState } from 'react';
import styles from './AnimalPhoto.module.css';

interface AnimalPhotoProps {
  photo: PhotoDto | null;
  /** Usa la miniatura (tarjetas, galería). */
  thumbnail?: boolean;
  /** 4:3 (tarjetas y foto principal) o 1:1 (miniaturas de galería). */
  ratio?: '4/3' | '1/1';
  lazy?: boolean;
  className?: string;
}

/**
 * Foto de un animal con el recuadro beige y la pluma cuando no hay foto o no
 * se puede cargar (DESIGN_SYSTEM §6.3): nunca un hueco vacío ni una imagen rota.
 */
export function AnimalPhoto({ photo, thumbnail = false, ratio = '4/3', lazy = true, className }: AnimalPhotoProps) {
  const [fallida, setFallida] = useState<string | null>(null);
  const src = photo ? ((thumbnail ? photo.thumbnailUrl : null) ?? photo.url) : null;
  const clase = [styles.frame, ratio === '1/1' ? styles.square : styles.landscape, className ?? ''].join(' ');

  if (!photo || !src || fallida === src) {
    // Si había foto, se conserva su texto alternativo; si no, es decorativo.
    const accesible = photo ? { role: 'img', 'aria-label': photo.altText } : { 'aria-hidden': true };
    return (
      <div className={`${clase} ${styles.placeholder}`} data-placeholder {...accesible}>
        <FontAwesomeIcon icon={faFeather} aria-hidden="true" className={styles.icon} />
      </div>
    );
  }

  return (
    <div className={clase}>
      <img
        src={src}
        alt={photo.altText}
        loading={lazy ? 'lazy' : 'eager'}
        className={styles.image}
        onError={() => setFallida(src)}
      />
    </div>
  );
}
