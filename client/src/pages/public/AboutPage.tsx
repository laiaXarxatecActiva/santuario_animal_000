import { useTranslation } from 'react-i18next';
import { ButtonLink } from '../../components/Button';
import styles from './AboutPage.module.css';

// Sobre el santuario (SCREENS §3.6). En la Fase 1 sin el formulario de
// contacto, que llega con CU-06 en la Fase 2.
export function AboutPage() {
  const { t } = useTranslation();
  return (
    <div className={`container ${styles.page}`}>
      <h1>{t('about.title')}</h1>
      <p className={styles.intro}>{t('about.intro')}</p>

      <section aria-labelledby="historia">
        <h2 id="historia">{t('about.historyTitle')}</h2>
        <p className={styles.text}>{t('about.historyText')}</p>
      </section>

      <section aria-labelledby="ubicacion">
        <h2 id="ubicacion">{t('about.locationTitle')}</h2>
        <p>{t('about.locationText')}</p>
        <p>{t('about.visitsText')}</p>
      </section>

      <ButtonLink to="/animals">{t('about.seeAnimals')}</ButtonLink>
    </div>
  );
}
