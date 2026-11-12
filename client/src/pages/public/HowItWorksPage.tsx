import { faStar } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import { AdoptionSteps } from '../../components/AdoptionSteps';
import { Alert } from '../../components/Alert';
import { Badge } from '../../components/Badge';
import { ButtonLink } from '../../components/Button';
import { usePlans } from '../../hooks/usePublicData';
import { formatCurrency } from '../../utils/format';
import styles from './HowItWorksPage.module.css';

const PREGUNTAS = ['manyAdopters', 'changePlan', 'cancel', 'passedAway'] as const;

// CU-04 Consultar cómo funciona la adopción simbólica (SCREENS §3.4).
export function HowItWorksPage() {
  const { t } = useTranslation();
  const planes = usePlans();

  return (
    <div className={`container ${styles.page}`}>
      <h1>{t('howItWorks.title')}</h1>
      <p className={styles.intro}>{t('howItWorks.intro')}</p>
      <Alert type="info" title={t('howItWorks.symbolicTitle')}>
        {t('howItWorks.symbolicText')}
      </Alert>

      <section aria-labelledby="pasos">
        <h2 id="pasos">{t('howItWorks.stepsTitle')}</h2>
        <AdoptionSteps detailed />
      </section>

      <section aria-labelledby="planes">
        <h2 id="planes">{t('howItWorks.plansTitle')}</h2>
        {planes.isError && <Alert type="error" title={t('howItWorks.plansError')} />}
        {planes.data && (
          <ul className={styles.plans}>
            {planes.data.map((plan) => (
              <li key={plan.id} className={styles.plan}>
                <h3>{plan.name}</h3>
                <p className={styles.amount}>
                  {t('howItWorks.perMonth', { amount: formatCurrency(plan.monthlyAmount) })}
                </p>
                {plan.description && <p>{plan.description}</p>}
                {plan.isDefault && (
                  <Badge tone="primary" icon={faStar}>
                    {t('howItWorks.mostCommon')}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="preguntas">
        <h2 id="preguntas">{t('howItWorks.faqTitle')}</h2>
        <div className={styles.faq}>
          {PREGUNTAS.map((p) => (
            <details key={p} className={styles.question}>
              <summary>{t(`howItWorks.faq.${p}Q`)}</summary>
              <p>{t(`howItWorks.faq.${p}A`)}</p>
            </details>
          ))}
        </div>
      </section>

      <ButtonLink to="/animals">{t('howItWorks.seeAnimals')}</ButtonLink>
    </div>
  );
}
