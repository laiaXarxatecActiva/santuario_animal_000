import type { AdoptionPlanDto } from '@sanctuary/shared';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../utils/format';
import styles from './PlanPicker.module.css';

// Selección de plan con tarjetas (radio) (DESIGN_SYSTEM §8.5).
interface PlanPickerProps {
  plans: AdoptionPlanDto[];
  value: number | undefined;
  onChange: (planId: number) => void;
  disabled?: boolean;
}

export function PlanPicker({ plans, value, onChange, disabled }: PlanPickerProps) {
  const { t } = useTranslation();
  return (
    <fieldset className={styles.fieldset} disabled={disabled}>
      <legend className={styles.legend}>{t('adopt.choosePlan')}</legend>
      <div className={styles.cards}>
        {plans.map((plan) => (
          <label key={plan.id} className={`${styles.card} ${plan.id === value ? styles.selected : ''}`}>
            <span className={styles.head}>
              <input
                type="radio"
                name="planId"
                value={plan.id}
                checked={plan.id === value}
                onChange={() => onChange(plan.id)}
              />
              <span className={styles.name}>{plan.name}</span>
            </span>
            <span className={styles.amount}>{t('adopt.perMonth', { amount: formatCurrency(plan.monthlyAmount) })}</span>
            <span className={styles.description}>{plan.description}</span>
          </label>
        ))}
      </div>
      <p className={styles.note}>{t('adopt.planNote')}</p>
    </fieldset>
  );
}
