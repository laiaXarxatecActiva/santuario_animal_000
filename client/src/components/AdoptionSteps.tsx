import { faFeather, faHandHoldingHeart, faNewspaper, faRightLong } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useTranslation } from 'react-i18next';
import styles from './AdoptionSteps.module.css';

const PASOS = [
  { icon: faFeather, title: 'steps.choose', text: 'howItWorks.stepChooseText' },
  { icon: faHandHoldingHeart, title: 'steps.plan', text: 'howItWorks.stepPlanText' },
  { icon: faNewspaper, title: 'steps.news', text: 'howItWorks.stepNewsText' },
] as const;

// Los tres pasos de la adopción simbólica (inicio y «Cómo funciona»), centrados
// y unidos por una flecha `right-long` (hacia abajo cuando van apilados en móvil).
export function AdoptionSteps({ detailed = false }: { detailed?: boolean }) {
  const { t } = useTranslation();
  return (
    <ol className={styles.steps}>
      {PASOS.map((paso, i) => (
        <li key={paso.title} className={styles.step}>
          {i > 0 && (
            <span className={styles.arrow} aria-hidden="true">
              <FontAwesomeIcon icon={faRightLong} />
            </span>
          )}
          <span className={styles.icon} aria-hidden="true">
            <FontAwesomeIcon icon={paso.icon} />
          </span>
          <div>
            <h3 className={styles.title}>
              <span className={styles.number}>{i + 1}.</span> {t(paso.title)}
            </h3>
            {detailed && <p className={styles.text}>{t(paso.text)}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
