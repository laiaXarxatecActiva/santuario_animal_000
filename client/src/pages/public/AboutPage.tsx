import { useTranslation } from 'react-i18next';
import { ButtonLink } from '../../components/Button';
import { ContactForm } from '../../components/ContactForm';
import styles from './AboutPage.module.css';

// Sobre el santuario y contacto (SCREENS §3.6): texto y formulario en dos
// columnas en escritorio; apilados en móvil.
export function AboutPage() {
  const { t } = useTranslation();
  return (
    <div className={`container ${styles.layout}`}>
      <div className={styles.page}>
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
      <ContactForm />
    </div>
  );
}
