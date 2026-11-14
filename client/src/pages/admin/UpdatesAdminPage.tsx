import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import { UpdatesList } from '../../components/admin/UpdatesList';
import { ButtonLink } from '../../components/Button';
import styles from './AdminPage.module.css';

// CU-31 y CU-32: «Actualizaciones» del panel (SCREENS §5.3).
export function UpdatesAdminPage() {
  const { t } = useTranslation();
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>{t('admin.updates.title')}</h1>
        <ButtonLink to="/admin/updates/new" icon={faPlus}>
          {t('admin.updates.new')}
        </ButtonLink>
      </div>
      <UpdatesList />
    </div>
  );
}
