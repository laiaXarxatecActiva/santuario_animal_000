import { faFeather } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import styles from './Logo.module.css';

// Logo provisional de texto (DESIGN_SYSTEM §6.2). Cuando haya imagen, solo cambia este componente.
export function Logo() {
  const { t } = useTranslation();
  return (
    <Link to="/" className={styles.logo} aria-label={t('app.name')}>
      <FontAwesomeIcon icon={faFeather} aria-hidden="true" className={styles.icon} />
      <span className={styles.full} aria-hidden="true">
        {t('app.name')}
      </span>
      <span className={styles.short} aria-hidden="true">
        {t('app.shortName')}
      </span>
    </Link>
  );
}
