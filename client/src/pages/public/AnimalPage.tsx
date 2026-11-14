import { faExpand, faFeather, faHandHoldingHeart, faUsers } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { AdoptionPlanDto, PublicAnimalDto } from '@sanctuary/shared';
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { ApiError } from '../../api/client';
import { Alert } from '../../components/Alert';
import { AnimalPhoto } from '../../components/AnimalPhoto';
import { Badge } from '../../components/Badge';
import { Button, ButtonLink } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { PhotoViewer } from '../../components/PhotoViewer';
import { UpdateCard } from '../../components/UpdateCard';
import { useAnimal, useAnimalUpdates, usePlans } from '../../hooks/usePublicData';
import { useSession } from '../../hooks/useSession';
import { formatCurrency, formatList, formatYear } from '../../utils/format';
import { parseId } from '../../utils/routeParams';
import styles from './AnimalPage.module.css';

const ULTIMAS_NOTICIAS = 3;

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
  const id = parseId(useParams().id);
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

  return (
    <AnimalProfile
      animal={animal.data}
      breadcrumb={{ to: '/animals', label: t('nav.animals') }}
      aside={<TarjetaAdoptar animal={animal.data} />}
      news={<UltimasNoticias animal={animal.data} />}
    />
  );
}

interface AnimalProfileProps {
  animal: PublicAnimalDto;
  /** Primer nivel de las migas de pan («Animales» o «Mis animales»). */
  breadcrumb: { to: string; label: string };
  /** Aviso bajo las migas de pan. */
  notice?: ReactNode;
  /** Tarjeta junto a la foto: «Adoptar» (CU-03) o «Tu adopción» (CU-16). */
  aside: ReactNode;
  /** Secciones tras el carácter y las necesidades (p. ej., «Su salud»). */
  extra?: ReactNode;
  news: ReactNode;
}

/** Estructura de la ficha del animal, común a la pública (CU-03) y a la ampliada (CU-16). */
export function AnimalProfile({ animal, breadcrumb, notice, aside, extra, news }: AnimalProfileProps) {
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
            <Link to={breadcrumb.to}>{breadcrumb.label}</Link>
          </li>
          <li aria-hidden="true">›</li>
          <li aria-current="page">{animal.name}</li>
        </ol>
      </nav>

      {notice && <div className={styles.notice}>{notice}</div>}

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

          {aside}
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

      {extra}

      {news}
    </article>
  );
}

function Galeria({ animal }: { animal: PublicAnimalDto }) {
  const { t } = useTranslation();
  const fotos = animal.photos.length > 0 ? animal.photos : animal.coverPhoto ? [animal.coverPhoto] : [];
  const [actual, setActual] = useState(0);
  const [visor, setVisor] = useState(false);
  const principal = fotos[actual] ?? null;

  return (
    <div className={styles.gallery}>
      {principal ? (
        // Pulsar la foto abre el visor (SCREENS §3.3, DESIGN_SYSTEM §8.9).
        <button
          type="button"
          className={styles.enlarge}
          aria-label={t('animalPage.enlargePhoto', { n: actual + 1, total: fotos.length })}
          onClick={() => setVisor(true)}
        >
          <AnimalPhoto photo={principal} lazy={false} className={styles.mainPhoto} />
          <span className={styles.enlargeIcon} aria-hidden="true">
            <FontAwesomeIcon icon={faExpand} />
          </span>
        </button>
      ) : (
        <AnimalPhoto photo={null} lazy={false} className={styles.mainPhoto} />
      )}
      {visor && (
        <PhotoViewer
          photos={fotos}
          start={actual}
          title={t('animalPage.gallery', { name: animal.name })}
          onClose={() => setVisor(false)}
        />
      )}
      {principal?.visibility === 'adopters' && (
        <div className={styles.exclusiveBadge}>
          <Badge tone="primary">{t('updates.adoptersOnly')}</Badge>
        </div>
      )}
      {fotos.length > 1 && (
        <ul className={styles.thumbs} aria-label={t('animalPage.gallery', { name: animal.name })}>
          {fotos.map((foto, i) => (
            <li key={foto.id}>
              <button
                type="button"
                className={styles.thumb}
                aria-label={t(
                  foto.visibility === 'adopters' ? 'animalPage.showPhotoExclusive' : 'animalPage.showPhoto',
                  { n: i + 1, total: fotos.length },
                )}
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

/**
 * ¿La tarjeta ya ha quedado por encima de la pantalla? Sin IntersectionObserver
 * (navegadores muy antiguos) la barra fija simplemente no aparece.
 */
function useYaPasada(ref: RefObject<HTMLElement | null>, activo: boolean): boolean {
  const [pasada, setPasada] = useState(false);
  useEffect(() => {
    const elemento = ref.current;
    if (!activo || !elemento || typeof IntersectionObserver === 'undefined') return;
    const observador = new IntersectionObserver(([entrada]) => {
      if (entrada) setPasada(!entrada.isIntersecting && entrada.boundingClientRect.top < 0);
    });
    observador.observe(elemento);
    return () => observador.disconnect();
  }, [ref, activo]);
  return activo && pasada;
}

function TarjetaAdoptar({ animal }: { animal: PublicAnimalDto }) {
  const { t } = useTranslation();
  const { user } = useSession();
  const planes = usePlans();
  const desde = planMasBarato(planes.data);
  const tarjeta = useRef<HTMLDivElement>(null);
  const yaAdopta = user?.role === 'adopter' && animal.exclusiveAccess;
  const barraFija = useYaPasada(tarjeta, animal.isAdoptable && !yaAdopta);

  // Variante «Ya adoptas a Rufo» (SCREENS §3.3): el servidor indica si tiene acceso.
  if (yaAdopta) {
    return (
      <div className={styles.adoptCard}>
        <h2 className={styles.adoptTitle}>{t('animalPage.alreadyAdopting', { name: animal.name })}</h2>
        <ButtonLink to={`/my-animals/${animal.id}`} block>
          {t('animalPage.seeFullProfile')}
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className={styles.adoptCard} ref={tarjeta}>
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
      {barraFija && (
        // Barra fija en móvil al pasar la tarjeta, para no tener que volver arriba (SCREENS §3.3).
        <div role="region" aria-label={t('animalPage.adopt', { name: animal.name })} className={styles.stickyBar}>
          <ButtonLink to={`/adopt/${animal.id}`} icon={faHandHoldingHeart} block>
            {t('animalPage.adopt', { name: animal.name })}
          </ButtonLink>
        </div>
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
              <UpdateCard update={noticia} headingLevel={3} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
