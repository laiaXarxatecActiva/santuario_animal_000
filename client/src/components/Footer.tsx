import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import styles from './Footer.module.css';

// Pie de la web pública (SCREENS §2.3).
export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.columns}`}>
        <div>
          <p className={styles.name}>{t('app.name')}</p>
          <p className={styles.tagline}>{t('footer.tagline')}</p>
        </div>
        <nav aria-label={t('footer.explore')}>
          <ul className={styles.list}>
            <li>
              <Link to="/animals">{t('nav.animals')}</Link>
            </li>
            <li>
              <Link to="/how-it-works">{t('nav.howItWorks')}</Link>
            </li>
            <li>
              <Link to="/donate">{t('nav.donate')}</Link>
            </li>
          </ul>
        </nav>
        <nav aria-label={t('footer.info')}>
          <ul className={styles.list}>
            <li>
              <Link to="/about">{t('footer.contact')}</Link>
            </li>
            <li>
              <Link to="/privacy">{t('footer.privacy')}</Link>
            </li>
            <li>
              <Link to="/cookies">{t('footer.cookies')}</Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className={`container ${styles.note}`}>
        <p>{t('footer.note')}</p>
      </div>
    </footer>
  );
}
