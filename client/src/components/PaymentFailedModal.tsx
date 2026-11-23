import { useTranslation } from 'react-i18next';
import { Alert } from './Alert';
import { Button } from './Button';
import { Modal } from './Modal';

// Aviso emergente del pago rechazado (DESIGN_SYSTEM §8.4): sustituye al aviso en
// la página cuando el pago simulado no se completa, y deja reintentarlo.
interface PaymentFailedModalProps {
  open: boolean;
  /** El mensaje de cada pantalla (por ejemplo, el plazo de 7 días de una adopción). */
  message: string;
  /** Vuelve a abrir la ventana de pago con los mismos datos. */
  onRetry: () => void;
  onClose: () => void;
}

export function PaymentFailedModal({ open, message, onRetry, onClose }: PaymentFailedModalProps) {
  const { t } = useTranslation();
  return (
    <Modal
      open={open}
      title={t('payment.failedTitle')}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('payment.notNow')}
          </Button>
          <Button onClick={onRetry}>{t('payment.retry')}</Button>
        </>
      }
    >
      <Alert type="error">{message}</Alert>
    </Modal>
  );
}
