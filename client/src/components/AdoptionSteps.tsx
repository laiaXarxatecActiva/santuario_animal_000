import { faFeather, faHandHoldingHeart, faNewspaper } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useTranslation } from 'react-i18next';
import styles from './AdoptionSteps.module.css';

const PASOS = [
  { icon: faFeather, title: 'steps.choose', text: 'howItWorks.stepChooseText' },
  { icon: faHandHoldingHeart, title: 'steps.plan', text: 'howItWorks.stepPlanText' },
  { icon: faNewspaper, title: 'steps.news', text: 'howItWorks.stepNewsText' },
] as const;

// Los tres pasos de la adopción simbólica (inicio y «Cómo funciona»).
export function AdoptionSteps({ detailed = false }: { detailed?: boolean }) {
  const { t } = useTranslation();
  return (
    <ol className={styles.steps}>
      {PASOS.map((paso, i) => (
        <li key={paso.title} className={styles.step}>
          <span className={styles.icon} aria-hidden="true">
            <FontAwesomeIcon icon={paso.icon} />
          </span>
          <div>
            <h3 className={styles.title}>
              <span className={styles.number}>{i + 1}.</span> {t(paso.title)}
            </h3>
            {detailed && <p>{t(paso.text)}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
