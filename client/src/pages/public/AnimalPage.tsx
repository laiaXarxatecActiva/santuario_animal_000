import { faFeather, faHandHoldingHeart, faNewspaper, faUsers } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { AdoptionPlanDto, PublicAnimalDto } from '@sanctuary/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { ApiError } from '../../api/client';
import { Alert } from '../../components/Alert';
import { AnimalPhoto } from '../../components/AnimalPhoto';
import { Badge } from '../../components/Badge';
import { Button, ButtonLink } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { useAnimal, useAnimalUpdates, usePlans } from '../../hooks/usePublicData';
import { formatCurrency, formatList, formatLongDate, formatYear } from '../../utils/format';
import styles from './AnimalPage.module.css';

const ULTIMAS_NOTICIAS = 3;

function idValido(valor: string | undefined): number | undefined {
  return valor && /^\d+$/.test(valor) && Number(valor) > 0 ? Number(valor) : undefined;
}

/** Plan más barato, para «Desde 1,00 € al mes». Solo compara; no suma importes. */
function planMasBarato(planes: AdoptionPlanDto[] | undefined): AdoptionPlanDto | undefined {
  return planes?.reduce<AdoptionPlanDto | undefined>(
    (min, p) => (min === undefined || Number(p.monthlyAmount) < Number(min.monthlyAmount) ? p : min),
    undefined,
  );
}

// CU-03 Consultar la ficha pública de un animal (SCREENS §3.3).
export function AnimalPage() {
  const { t } = useTranslation();
  const id = idValido(useParams().id);
  const animal = useAnimal(id);

  const noDisponible = id === undefined || (animal.error instanceof ApiError && animal.error.status === 404);
  if (noDisponible) {
    return (
      <div className="container">
        <EmptyState
          icon={faFeather}
          message={
            <>
              <h1 className={styles.notAvailableTitle}>{t('animalPage.notAvailable')}</h1>
              <span>{t('animalPage.notAvailableText')}</span>
            </>
          }
          action={<ButtonLink to="/animals">{t('animalPage.backToCatalog')}</ButtonLink>}
        />
      </div>
    );
  }

  if (animal.isError) {
    return (
      <div className="container">
        <Alert
          type="error"
          title={t('animalPage.errorLoading')}
          action={
            <Button variant="outline" onClick={() => void animal.refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      </div>
    );
  }

  if (!animal.data) {
    return (
      <div className="container" aria-busy="true">
        <div className={styles.loading}>
          <AnimalPhoto photo={null} />
          <p>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return <Ficha animal={animal.data} />;
}

function Ficha({ animal }: { animal: PublicAnimalDto }) {
  const { t } = useTranslation();
  const sep = t('common.listSeparator');

  const especie = [animal.species.name, animal.breed, t(`animal.sex.${animal.sex}`)].filter(Boolean).join(sep);
  const edad =
    animal.approxAgeYears === null
      ? null
      : animal.approxAgeYears === 0
        ? t('animalPage.approxAgeUnderOne')
        : t('animalPage.approxAge', { count: animal.approxAgeYears });
  const datos = [edad, t('animalPage.inSanctuarySince', { year: formatYear(animal.arrivalDate) })]
    .filter(Boolean)
    .join(sep);

  return (
    <article className="container">
      <nav aria-label={t('animalPage.breadcrumb')} className={styles.breadcrumb}>
        <ol>
          <li>
            <Link to="/animals">{t('nav.animals')}</Link>
          </li>
          <li aria-hidden="true">›</li>
          <li aria-current="page">{animal.name}</li>
        </ol>
      </nav>

      <div className={styles.top}>
        <Galeria animal={animal} />

        <div className={styles.summary}>
          <h1>{animal.name}</h1>
          <p className={styles.meta}>{especie}</p>
          <p className={styles.meta}>{datos}</p>
          {animal.status === 'in_treatment' && <Badge tone="info">{t('animal.inTreatment')}</Badge>}

          <div className={styles.adopters}>
            <FontAwesomeIcon icon={faUsers} aria-hidden="true" />
            <div>
              {animal.adopterCount === 0 ? (
                <p>{t('animalPage.noAdopters', { name: animal.name })}</p>
              ) : (
                <>
                  <p>{t('animalPage.adopterCount', { count: animal.adopterCount, name: animal.name })}</p>
                  {animal.publicAdopterNames.length > 0 && (
                    <p className={styles.muted}>
                      {t('animalPage.supportedBy', { names: formatList(animal.publicAdopterNames) })}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          <TarjetaAdoptar animal={animal} />
        </div>
      </div>

      {animal.rescueStory && (
        <section className={styles.section}>
          <h2>{t('animalPage.story')}</h2>
          <p className={`reading ${styles.text} ${styles.story}`}>{animal.rescueStory}</p>
        </section>
      )}

      {(animal.temperament || animal.specialNeeds) && (
        <div className={`${styles.section} ${styles.twoColumns}`}>
          {animal.temperament && (
            <section>
              <h2>{t('animalPage.temperament')}</h2>
              <p className={`reading ${styles.text}`}>{animal.temperament}</p>
            </section>
          )}
          {animal.specialNeeds && (
            <section>
              <h2>{t('animalPage.specialNeeds')}</h2>
              <p className={`reading ${styles.text}`}>{animal.specialNeeds}</p>
            </section>
          )}
        </div>
      )}

      <UltimasNoticias animal={animal} />
    </article>
  );
}

function Galeria({ animal }: { animal: PublicAnimalDto }) {
  const { t } = useTranslation();
  const fotos = animal.photos.length > 0 ? animal.photos : animal.coverPhoto ? [animal.coverPhoto] : [];
  const [actual, setActual] = useState(0);
  const principal = fotos[actual] ?? null;

  return (
    <div className={styles.gallery}>
      <AnimalPhoto photo={principal} lazy={false} className={styles.mainPhoto} />
      {fotos.length > 1 && (
        <ul className={styles.thumbs} aria-label={t('animalPage.gallery', { name: animal.name })}>
          {fotos.map((foto, i) => (
            <li key={foto.id}>
              <button
                type="button"
                className={styles.thumb}
                aria-label={t('animalPage.showPhoto', { n: i + 1, total: fotos.length })}
                aria-pressed={i === actual}
                onClick={() => setActual(i)}
              >
                <AnimalPhoto photo={{ ...foto, altText: '' }} thumbnail ratio="1/1" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TarjetaAdoptar({ animal }: { animal: PublicAnimalDto }) {
  const { t } = useTranslation();
  const planes = usePlans();
  const desde = planMasBarato(planes.data);

  return (
    <div className={styles.adoptCard}>
      <h2 className={styles.adoptTitle}>{t('animalPage.adoptCardTitle')}</h2>
      <p>{t('animalPage.adoptCardText', { name: animal.name })}</p>
      {animal.isAdoptable ? (
        <>
          {desde && (
            <p className={styles.from}>{t('animalPage.fromAmount', { amount: formatCurrency(desde.monthlyAmount) })}</p>
          )}
          <ButtonLink to={`/adopt/${animal.id}`} icon={faHandHoldingHeart} block>
            {t('animalPage.adopt', { name: animal.name })}
          </ButtonLink>
        </>
      ) : (
        <p className={styles.notAdoptable}>{t('animalPage.notAdoptable')}</p>
      )}
    </div>
  );
}

function UltimasNoticias({ animal }: { animal: PublicAnimalDto }) {
  const { t } = useTranslation();
  const noticias = useAnimalUpdates(animal.id, ULTIMAS_NOTICIAS);

  return (
    <section className={styles.section} aria-labelledby="ultimas-noticias">
      <h2 id="ultimas-noticias">{t('animalPage.latestNews')}</h2>
      {noticias.isError && <Alert type="error" title={t('animalPage.errorLoadingNews')} />}
      {noticias.data?.data.length === 0 && (
        <p className={styles.muted}>{t('animalPage.noNews', { name: animal.name })}</p>
      )}
      {noticias.data && noticias.data.data.length > 0 && (
        <ul className={styles.news}>
          {noticias.data.data.map((noticia) => (
            <li key={noticia.id}>
              <article className={styles.newsCard}>
                <p className={styles.newsDate}>
                  <FontAwesomeIcon icon={faNewspaper} aria-hidden="true" />
                  <time dateTime={noticia.publishedAt}>{formatLongDate(noticia.publishedAt)}</time>
                </p>
                <h3>{noticia.title}</h3>
                <p className={`reading ${styles.text}`}>{noticia.body}</p>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
