import { faFeather } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useTranslation } from 'react-i18next';
import { ButtonLink } from '../components/Button';
import styles from './NotFoundPage.module.css';

// Página no encontrada (SCREENS §6).
export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className={`container ${styles.page}`}>
      <FontAwesomeIcon icon={faFeather} aria-hidden="true" className={styles.icon} />
      <h1>{t('notFound.title')}</h1>
      <p>{t('notFound.text')}</p>
      <div className={styles.actions}>
        <ButtonLink to="/">{t('notFound.home')}</ButtonLink>
        <ButtonLink to="/animals" variant="outline">
          {t('notFound.animals')}
        </ButtonLink>
      </div>
    </div>
  );
}
