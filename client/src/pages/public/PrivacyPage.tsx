import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Alert } from '../../components/Alert';
import { formatDate } from '../../utils/format';
import { LEGAL_UPDATED } from './legal';
import styles from './LegalPages.module.css';

const SECCIONES = ['responsible', 'data', 'purpose', 'retention', 'sharing', 'rights'] as const;
// Enlaces dentro del texto de cada sección (componente <0> de <Trans>).
const ENLACES: Partial<Record<(typeof SECCIONES)[number], string>> = { responsible: '/about', rights: '/profile' };

// Política de privacidad (SCREENS §3.9, TECH_SPEC §13: RGPD).
export function PrivacyPage() {
  const { t } = useTranslation();
  return (
    <div className={`container ${styles.page}`}>
      <h1>{t('legal.privacy.title')}</h1>
      <p className={styles.updated}>{t('legal.lastUpdated', { date: formatDate(LEGAL_UPDATED) })}</p>
      <Alert type="info">{t('legal.academicNote')}</Alert>
      {SECCIONES.map((s) => {
        const enlace = ENLACES[s];
        return (
          <section key={s} aria-labelledby={`privacidad-${s}`}>
            <h2 id={`privacidad-${s}`}>{t(`legal.privacy.${s}Title`)}</h2>
            <p>
              {enlace ? (
                <Trans i18nKey={`legal.privacy.${s}Text`} components={[<Link key={s} to={enlace} />]} />
              ) : (
                t(`legal.privacy.${s}Text`)
              )}
            </p>
          </section>
        );
      })}
      <p>
        <Trans i18nKey="legal.privacy.cookiesText" components={[<Link key="cookies" to="/cookies" />]} />
      </p>
    </div>
  );
}
