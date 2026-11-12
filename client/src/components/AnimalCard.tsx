import { faFeather, faUsers } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { AnimalCardDto } from '@sanctuary/shared';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { AnimalPhoto } from './AnimalPhoto';
import styles from './AnimalCard.module.css';
import { Badge } from './Badge';

// Tarjeta de animal (DESIGN_SYSTEM §8.2): toda la tarjeta es un único enlace.
export function AnimalCard({ animal }: { animal: AnimalCardDto }) {
  const { t } = useTranslation();
  const enTratamiento = animal.status === 'in_treatment';

  return (
    <Link to={`/animals/${animal.id}`} className={styles.card}>
      <AnimalPhoto photo={animal.coverPhoto} thumbnail className={styles.photo} />
      <div className={styles.body}>
        <h3 className={styles.name}>{animal.name}</h3>
        <p className={styles.meta}>
          <FontAwesomeIcon icon={faFeather} aria-hidden="true" />
          <span>{[animal.species.name, t(`animal.sex.${animal.sex}`)].join(t('common.listSeparator'))}</span>
        </p>
        <p className={styles.meta}>
          <FontAwesomeIcon icon={faUsers} aria-hidden="true" />
          <span>
            {animal.adopterCount === 0 ? t('animal.noAdopters') : t('animal.adopters', { count: animal.adopterCount })}
          </span>
        </p>
        {(enTratamiento || !animal.isAdoptable) && (
          <div className={styles.badges}>
            {enTratamiento && <Badge tone="info">{t('animal.inTreatment')}</Badge>}
            {!animal.isAdoptable && <Badge>{t('animal.notAdoptable')}</Badge>}
          </div>
        )}
      </div>
    </Link>
  );
}
