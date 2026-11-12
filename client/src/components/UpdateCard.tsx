import { faNewspaper } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { AnimalUpdateDto, PhotoDto } from '@sanctuary/shared';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReadMark } from '../hooks/useFeed';
import { formatLongDate } from '../utils/format';
import { AnimalPhoto } from './AnimalPhoto';
import { Badge } from './Badge';
import { Button } from './Button';
import styles from './UpdateCard.module.css';

interface UpdateCardProps {
  update: AnimalUpdateDto;
  headingLevel: 2 | 3;
  /** En el muro se indica de qué animal es. */
  animal?: { name: string; coverPhoto: PhotoDto | null };
  /** Botón para volver a marcarla como no leída (CU-17 paso 4). */
  allowToggle?: boolean;
}

/**
 * Actualización de un animal (CU-03, CU-16, CU-17). Si llega con `isRead`, la
 * marca «Nuevo» refleja cómo estaba al cargar la página y se marca como leída
 * en cuanto se ve en pantalla.
 */
export function UpdateCard({ update, headingLevel, animal, allowToggle = false }: UpdateCardProps) {
  const { t } = useTranslation();
  const { markRead, markUnread } = useReadMark();
  const conLectura = update.isRead !== undefined;
  const [leida, setLeida] = useState(update.isRead ?? true);
  const vista = useRef(false);
  const tarjeta = useRef<HTMLElement>(null);
  const marcarLeida = useRef(markRead.mutate);
  useEffect(() => {
    marcarLeida.current = markRead.mutate;
  });

  // Se marca como leída la primera vez que aparece en pantalla.
  useEffect(() => {
    const elemento = tarjeta.current;
    if (!conLectura || leida || vista.current || !elemento || typeof IntersectionObserver === 'undefined') return;
    const observador = new IntersectionObserver((entradas) => {
      if (!entradas.some((e) => e.isIntersecting) || vista.current) return;
      vista.current = true;
      observador.disconnect();
      marcarLeida.current(update.id, { onSuccess: () => setLeida(true) });
    });
    observador.observe(elemento);
    return () => observador.disconnect();
  }, [conLectura, leida, update.id]);

  const Titulo = headingLevel === 2 ? 'h2' : 'h3';
  const cambiando = markRead.isPending || markUnread.isPending;
  const alternar = () => {
    vista.current = true;
    if (leida) markUnread.mutate(update.id, { onSuccess: () => setLeida(false) });
    else markRead.mutate(update.id, { onSuccess: () => setLeida(true) });
  };

  return (
    <article ref={tarjeta} className={`${styles.card} ${update.isRead === false ? styles.unread : ''}`}>
      <div className={styles.header}>
        {animal && (
          <div className={styles.animal}>
            <AnimalPhoto photo={animal.coverPhoto && { ...animal.coverPhoto, altText: '' }} thumbnail ratio="1/1" />
            <span className={styles.animalName}>{animal.name}</span>
          </div>
        )}
        <p className={styles.date}>
          {!animal && <FontAwesomeIcon icon={faNewspaper} aria-hidden="true" />}
          <time dateTime={update.publishedAt}>{formatLongDate(update.publishedAt)}</time>
        </p>
        <div className={styles.badges}>
          {update.visibility === 'adopters' && <Badge tone="primary">{t('updates.adoptersOnly')}</Badge>}
          {update.isRead === false && <Badge tone="new">{t('updates.new')}</Badge>}
        </div>
      </div>
      <Titulo className={styles.title}>{update.title}</Titulo>
      <p className={`reading ${styles.text}`}>{update.body}</p>
      {update.photos.length > 0 && (
        <ul className={styles.media} aria-label={t('updates.photos', { title: update.title })}>
          {update.photos.map((foto) => (
            <li key={foto.id}>
              {foto.mediaType === 'video' ? (
                <video
                  className={styles.video}
                  src={foto.url}
                  poster={foto.thumbnailUrl ?? undefined}
                  controls
                  preload="none"
                  aria-label={foto.altText}
                />
              ) : (
                <AnimalPhoto photo={foto} />
              )}
            </li>
          ))}
        </ul>
      )}
      {conLectura && allowToggle && (
        <div className={styles.actions}>
          <Button variant="ghost" disabled={cambiando} onClick={alternar}>
            {leida ? t('updates.markUnread') : t('updates.markRead')}
          </Button>
        </div>
      )}
    </article>
  );
}
