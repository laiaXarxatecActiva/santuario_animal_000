import { PAYMENT_MODES, type PaymentMode } from '@sanctuary/shared';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './PlanPicker.module.css';
import propios from './PaymentModePicker.module.css';

// CU-49: forma de pago con tarjetas (radio), como la selección de plan (DESIGN_SYSTEM §8.5).
interface PaymentModePickerProps {
  value: PaymentMode;
  onChange: (paymentMode: PaymentMode) => void;
  disabled?: boolean;
}

export function PaymentModePicker({ value, onChange, disabled }: PaymentModePickerProps) {
  const { t } = useTranslation();
  const nombre = useId();
  return (
    <fieldset className={styles.fieldset} disabled={disabled}>
      <legend className={styles.legend}>{t('paymentMode.title')}</legend>
      <div className={`${styles.cards} ${propios.twoColumns}`}>
        {PAYMENT_MODES.map((modo) => (
          <label key={modo} className={`${styles.card} ${modo === value ? styles.selected : ''}`}>
            <span className={styles.head}>
              <input type="radio" name={nombre} value={modo} checked={modo === value} onChange={() => onChange(modo)} />
              <span className={styles.name}>{t(`paymentMode.${modo}`)}</span>
            </span>
            <span className={styles.description}>{t(`paymentMode.${modo}Help`)}</span>
          </label>
        ))}
      </div>
      <p className={styles.note}>{t('paymentMode.note')}</p>
    </fieldset>
  );
}
