import { faFeather, faStethoscope } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { isOpenAdoptionStatus, type AdoptionDto, type PublicAnimalDto } from '@sanctuary/shared';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { ApiError } from '../../api/client';
import { AdoptionStatusBadge } from '../../components/AdoptionStatusBadge';
import { Alert } from '../../components/Alert';
import { AnimalPhoto } from '../../components/AnimalPhoto';
import { Button, ButtonLink } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { UpdateCard } from '../../components/UpdateCard';
import { useMyAdoptionsOf } from '../../hooks/useAdoptions';
import { useAnimal, useAnimalUpdates } from '../../hooks/usePublicData';
import { formatCurrency, formatDate } from '../../utils/format';
import { parseId } from '../../utils/routeParams';
import { AnimalProfile } from '../public/AnimalPage';
import publicStyles from '../public/AnimalPage.module.css';
import styles from './AdoptedAnimalPage.module.css';

// La ficha ampliada muestra todo el historial de noticias (nota de CU-17).
const NOTICIAS = 50;

// CU-16 Consultar la ficha ampliada de un animal adoptado (SCREENS §4.3).
export function AdoptedAnimalPage() {
  const { t } = useTranslation();
  const id = parseId(useParams().animalId);
  const animal = useAnimal(id);
  const adopciones = useMyAdoptionsOf(id, true);

  if (id === undefined || (animal.error instanceof ApiError && animal.error.status === 404)) {
    return (
      <div className="container">
        <EmptyState
          icon={faFeather}
          message={t('animalPage.notAvailable')}
          action={<ButtonLink to="/my-animals">{t('adoptedAnimal.backToMyAnimals')}</ButtonLink>}
        />
      </div>
    );
  }

  if (animal.isError || adopciones.isError) {
    return (
      <div className="container">
        <Alert
          type="error"
          title={t('adoptedAnimal.errorLoading')}
          action={
            <Button
              variant="outline"
              onClick={() => {
                void animal.refetch();
                void adopciones.refetch();
              }}
            >
              {t('common.retry')}
            </Button>
          }
        />
      </div>
    );
  }

  if (!animal.data || !adopciones.data) {
    return (
      <div className="container" aria-busy="true">
        <div className={publicStyles.loading}>
          <AnimalPhoto photo={null} />
          <p>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  // La adopción abierta o, si no hay ninguna, no se muestra la tarjeta.
  const adopcion = adopciones.data.find((a) => isOpenAdoptionStatus(a.status));
  const datos = animal.data;

  return (
    <AnimalProfile
      animal={datos}
      breadcrumb={{ to: '/my-animals', label: t('nav.myAnimals') }}
      notice={datos.exclusiveAccess ? undefined : <AvisoSinAcceso animal={datos} adopcion={adopcion} />}
      aside={adopcion && <TuAdopcion adopcion={adopcion} />}
      extra={datos.healthSummary && <Salud texto={datos.healthSummary} />}
      news={<Noticias animal={datos} />}
    />
  );
}

/** 1a: por qué no se ve el contenido exclusivo y, si procede, «Pagar ahora» (CU-14). */
function AvisoSinAcceso({ animal, adopcion }: { animal: PublicAnimalDto; adopcion: AdoptionDto | undefined }) {
  const { t } = useTranslation();
  const nombre = animal.name;
  const pagar = adopcion?.canPay ? <ButtonLink to={`/adopt/${animal.id}`}>{t('adopt.payNow')}</ButtonLink> : undefined;

  if (adopcion?.status === 'pending') {
    return (
      <Alert type="warning" action={pagar}>
        {adopcion.canPay
          ? t('adoptedAnimal.pendingNotice', { name: nombre })
          : t('adoption.paymentExpired', { name: nombre })}
      </Alert>
    );
  }
  if (adopcion?.status === 'paused') {
    return (
      <Alert type="warning" action={pagar}>
        {t('adoptedAnimal.pausedNotice', { name: nombre })}
      </Alert>
    );
  }
  return (
    <Alert
      type="info"
      action={
        <ButtonLink variant="outline" to={`/animals/${animal.id}`}>
          {t('adoptedAnimal.seePublic')}
        </ButtonLink>
      }
    >
      {t('adoptedAnimal.noAdoptionNotice', { name: nombre })}
    </Alert>
  );
}

function TuAdopcion({ adopcion }: { adopcion: AdoptionDto }) {
  const { t } = useTranslation();
  return (
    <section className={publicStyles.adoptCard} aria-labelledby="tu-adopcion">
      <div className={styles.cardHeading}>
        <h2 id="tu-adopcion" className={publicStyles.adoptTitle}>
          {t('adoptedAnimal.yourAdoption')}
        </h2>
        <AdoptionStatusBadge status={adopcion.status} />
      </div>
      <p>{t('adoption.plan', { plan: adopcion.plan.name, amount: formatCurrency(adopcion.plan.monthlyAmount) })}</p>
      {adopcion.startDate && <p>{t('adoption.since', { date: formatDate(adopcion.startDate) })}</p>}
      {adopcion.nextUpdateExpected && (
        <p>{t('adoption.nextUpdate', { date: formatDate(adopcion.nextUpdateExpected) })}</p>
      )}
      {adopcion.cancelRequested && adopcion.endDate && (
        <p>{t('adoption.activeUntil', { date: formatDate(adopcion.endDate) })}</p>
      )}
      <ButtonLink variant="outline" to="/my-animals" block>
        {t('adoptedAnimal.backToMyAnimals')}
      </ButtonLink>
    </section>
  );
}

function Salud({ texto }: { texto: string }) {
  const { t } = useTranslation();
  return (
    <section className={publicStyles.section} aria-labelledby="su-salud">
      <h2 id="su-salud">{t('adoptedAnimal.health')}</h2>
      <div className={styles.health}>
        <FontAwesomeIcon icon={faStethoscope} aria-hidden="true" className={styles.healthIcon} />
        <p className={`reading ${publicStyles.text}`}>{texto}</p>
      </div>
    </section>
  );
}

function Noticias({ animal }: { animal: PublicAnimalDto }) {
  const { t } = useTranslation();
  const noticias = useAnimalUpdates(animal.id, NOTICIAS);

  return (
    <section className={publicStyles.section} aria-labelledby="noticias">
      <h2 id="noticias">{t('adoptedAnimal.news')}</h2>
      {noticias.isError && <Alert type="error" title={t('animalPage.errorLoadingNews')} />}
      {noticias.data?.data.length === 0 && (
        <p className={publicStyles.muted}>{t('adoptedAnimal.noNews', { name: animal.name })}</p>
      )}
      {noticias.data && noticias.data.data.length > 0 && (
        <ul className={publicStyles.news}>
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
