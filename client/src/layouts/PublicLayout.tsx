import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';
import { Footer } from '../components/Footer';
import { PublicHeader } from '../components/PublicHeader';
import styles from './PublicLayout.module.css';

// Plantilla de la web pública (SCREENS §2).
export function PublicLayout() {
  const { t } = useTranslation();
  return (
    <>
      <a href="#main" className={styles.skipLink}>
        {t('common.skipToContent')}
      </a>
      <PublicHeader />
      <main id="main" tabIndex={-1} className={styles.main}>
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
