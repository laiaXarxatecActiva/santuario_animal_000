import type { SimulatedOutcome } from '@sanctuary/shared';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../utils/format';
import { Alert } from './Alert';
import { Button } from './Button';
import { Modal } from './Modal';
import styles from './PaymentModal.module.css';

// Pasarela de pago simulado (DESIGN_SYSTEM §8.4). Nunca pide datos de tarjeta.
interface PaymentModalProps {
  open: boolean;
  concept: string;
  /** Importe como string (`"5.00"`). */
  amount: string;
  /** Hay un pago en curso: no se puede cerrar ni volver a pulsar. */
  processing: boolean;
  onPay: (outcome: SimulatedOutcome) => void;
  onClose: () => void;
}

export function PaymentModal({ open, concept, amount, processing, onPay, onClose }: PaymentModalProps) {
  const { t } = useTranslation();
  return (
    <Modal
      open={open}
      title={t('payment.title')}
      onClose={onClose}
      closable={!processing}
      footer={
        <>
          <Button variant="outline" disabled={processing} onClick={() => onPay('failure')}>
            {t('payment.fail')}
          </Button>
          <Button disabled={processing} onClick={() => onPay('success')}>
            {processing ? t('payment.processing') : t('payment.succeed')}
          </Button>
        </>
      }
    >
      <dl className={styles.details}>
        <div>
          <dt>{t('payment.concept')}</dt>
          <dd>{concept}</dd>
        </div>
        <div>
          <dt>{t('payment.amount')}</dt>
          <dd className={styles.amount}>{formatCurrency(amount)}</dd>
        </div>
      </dl>
      <Alert type="info">{t('payment.notice')}</Alert>
    </Modal>
  );
}
