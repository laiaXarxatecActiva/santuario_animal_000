import { faNewspaper } from '@fortawesome/free-solid-svg-icons';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '../../components/Alert';
import { Button, ButtonLink } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { UpdateCard } from '../../components/UpdateCard';
import { useMyAdoptions } from '../../hooks/useAdoptions';
import { useFeed } from '../../hooks/useFeed';
import styles from './FeedPage.module.css';

// CU-17 Consultar el muro de actualizaciones (SCREENS §4.4).
export function FeedPage() {
  const { t } = useTranslation();
  const idSelector = useId();
  const [soloNoLeidas, setSoloNoLeidas] = useState(false);
  const [animalId, setAnimalId] = useState<number | undefined>();
  const muro = useFeed({ unread: soloNoLeidas, animalId });
  const adopciones = useMyAdoptions();

  // Solo los animales con adopción activa tienen novedades en el muro.
  const animales = (adopciones.data ?? []).filter((a) => a.status === 'active').map((a) => a.animal);
  const actualizaciones = muro.data?.pages.flatMap((p) => p.data) ?? [];

  let contenido;
  if (muro.isError) {
    contenido = (
      <Alert
        type="error"
        title={t('feed.errorLoading')}
        action={
          <Button variant="outline" onClick={() => void muro.refetch()}>
            {t('common.retry')}
          </Button>
        }
      />
    );
  } else if (!muro.data) {
    contenido = <p aria-busy="true">{t('common.loading')}</p>;
  } else if (actualizaciones.length === 0) {
    contenido = (
      <EmptyState
        icon={faNewspaper}
        message={soloNoLeidas ? t('feed.emptyUnread') : t('feed.empty')}
        action={
          soloNoLeidas ? undefined : (
            <ButtonLink variant="outline" to="/my-animals">
              {t('nav.myAnimals')}
            </ButtonLink>
          )
        }
      />
    );
  } else {
    contenido = (
      <>
        <ul className={styles.list}>
          {actualizaciones.map((actualizacion) => (
            <li key={actualizacion.id}>
              <UpdateCard update={actualizacion} animal={actualizacion.animal} headingLevel={2} allowToggle />
            </li>
          ))}
        </ul>
        {muro.hasNextPage && (
          <div className={styles.more}>
            <Button variant="outline" disabled={muro.isFetchingNextPage} onClick={() => void muro.fetchNextPage()}>
              {muro.isFetchingNextPage ? t('common.loading') : t('feed.loadMore')}
            </Button>
          </div>
        )}
      </>
    );
  }

  return (
    <div className={`container ${styles.page}`}>
      <h1>{t('feed.title')}</h1>
      <div className={styles.filters}>
        <fieldset className={styles.fieldset}>
          <legend className={styles.label}>{t('feed.show')}</legend>
          <label className={styles.radio}>
            <input type="radio" name="feed-show" checked={!soloNoLeidas} onChange={() => setSoloNoLeidas(false)} />
            {t('feed.all')}
          </label>
          <label className={styles.radio}>
            <input type="radio" name="feed-show" checked={soloNoLeidas} onChange={() => setSoloNoLeidas(true)} />
            {t('feed.unread')}
          </label>
        </fieldset>
        <div className={styles.animalFilter}>
          <label htmlFor={idSelector} className={styles.label}>
            {t('feed.animal')}
          </label>
          <select
            id={idSelector}
            className={styles.select}
            value={animalId ?? ''}
            onChange={(e) => setAnimalId(e.target.value === '' ? undefined : Number(e.target.value))}
          >
            <option value="">{t('feed.allAnimals')}</option>
            {animales.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {contenido}
    </div>
  );
}
