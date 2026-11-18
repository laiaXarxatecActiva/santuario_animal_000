import { faDove, faFeather } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { MemorialAnimalDto } from '@sanctuary/shared';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Alert } from '../../components/Alert';
import { AnimalPhoto } from '../../components/AnimalPhoto';
import cardStyles from '../../components/AnimalCard.module.css';
import { Button } from '../../components/Button';
import { CardSkeletons } from '../../components/CardSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { useMemorial } from '../../hooks/usePublicData';
import { formatYear } from '../../utils/format';
import styles from './MemorialPage.module.css';

/** «2022 – 2026»: del año de llegada al del fallecimiento. */
export const añosEnElSantuario = (animal: Pick<MemorialAnimalDto, 'arrivalDate' | 'deathDate'>) =>
  animal.deathDate
    ? `${formatYear(animal.arrivalDate)} – ${formatYear(animal.deathDate)}`
    : formatYear(animal.arrivalDate);

// CU-12 «En memoria» (SCREENS §3.7): tono sobrio, sin adopciones ni adornos.
export function MemorialPage() {
  const { t } = useTranslation();
  const memorial = useMemorial();

  return (
    <div className="container">
      <header className={styles.intro}>
        <h1>{t('memorial.title')}</h1>
        <p className="reading">{t('memorial.intro')}</p>
      </header>

      {memorial.isError ? (
        <Alert
          type="error"
          action={
            <Button variant="outline" onClick={() => void memorial.refetch()}>
              {t('common.retry')}
            </Button>
          }
        >
          {t('memorial.loadError')}
        </Alert>
      ) : !memorial.data ? (
        <CardSkeletons count={3} />
      ) : memorial.data.length === 0 ? (
        // 2a: mensaje neutro si se entra por la URL.
        <EmptyState icon={faDove} message={t('memorial.empty')} />
      ) : (
        <ul className="card-grid">
          {memorial.data.map((animal) => (
            <li key={animal.id}>
              <Link to={`/memorial/${animal.id}`} className={cardStyles.card}>
                <AnimalPhoto photo={animal.coverPhoto} thumbnail className={cardStyles.photo} />
                <div className={cardStyles.body}>
                  <h2 className={cardStyles.name}>{animal.name}</h2>
                  <p className={cardStyles.meta}>
                    <FontAwesomeIcon icon={faFeather} aria-hidden="true" />
                    <span>{animal.species.name}</span>
                  </p>
                  <p className={cardStyles.meta}>{añosEnElSantuario(animal)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
