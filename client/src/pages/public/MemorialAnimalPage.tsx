import { faDove } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { Alert } from '../../components/Alert';
import { EmptyState } from '../../components/EmptyState';
import { UpdateCard } from '../../components/UpdateCard';
import { useMemorial } from '../../hooks/usePublicData';
import { formatDate } from '../../utils/format';
import { parseId } from '../../utils/routeParams';
import { Galeria } from './AnimalPage';
import styles from './AnimalPage.module.css';

// CU-12 paso 3: ficha de solo lectura, sin botón de adoptar y con sus
// actualizaciones públicas.
export function MemorialAnimalPage() {
  const { t } = useTranslation();
  const id = parseId(useParams().id);
  const memorial = useMemorial();

  if (memorial.isError) return <Alert type="error">{t('memorial.loadError')}</Alert>;
  if (!memorial.data) return <p aria-busy="true">{t('common.loading')}</p>;
  const animal = memorial.data.find((a) => a.id === id);
  if (!animal) {
    return (
      <div className="container">
        <EmptyState
          icon={faDove}
          message={t('memorial.notFound')}
          action={<Link to="/memorial">{t('memorial.back')}</Link>}
        />
      </div>
    );
  }

  const sep = t('common.listSeparator');
  return (
    <article className="container">
      <nav aria-label={t('animalPage.breadcrumb')} className={styles.breadcrumb}>
        <ol>
          <li>
            <Link to="/memorial">{t('memorial.title')}</Link>
          </li>
          <li aria-hidden="true">›</li>
          <li aria-current="page">{animal.name}</li>
        </ol>
      </nav>

      <div className={styles.top}>
        <Galeria animal={animal} />
        <div className={styles.summary}>
          <h1>{animal.name}</h1>
          <p className={styles.meta}>{[animal.species.name, t(`animal.sex.${animal.sex}`)].join(sep)}</p>
          <p className={styles.meta}>{t('memorial.arrived', { date: formatDate(animal.arrivalDate) })}</p>
          {animal.deathDate && (
            <p className={styles.meta}>{t('memorial.died', { date: formatDate(animal.deathDate) })}</p>
          )}
        </div>
      </div>

      {animal.rescueStory && (
        <section className={styles.section}>
          <h2>{t('animalPage.story')}</h2>
          <p className={`reading ${styles.text} ${styles.story}`}>{animal.rescueStory}</p>
        </section>
      )}

      <section className={styles.section} aria-labelledby="noticias">
        <h2 id="noticias">{t('memorial.news')}</h2>
        {animal.updates.length === 0 ? (
          <p className={styles.muted}>{t('animalPage.noNews', { name: animal.name })}</p>
        ) : (
          <ul className={styles.news}>
            {animal.updates.map((noticia) => (
              <li key={noticia.id}>
                <UpdateCard update={noticia} headingLevel={3} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}
