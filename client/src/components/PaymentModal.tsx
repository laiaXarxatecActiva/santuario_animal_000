import { zodResolver } from '@hookform/resolvers/zod';
import { tarjetaSimuladaSchema, type SimulatedOutcome, type TarjetaSimuladaInput } from '@sanctuary/shared';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../utils/format';
import { Alert } from './Alert';
import { Button } from './Button';
import { TextField } from './FormFields';
import { Modal } from './Modal';
import styles from './PaymentModal.module.css';

/**
 * Aviso de que el pago es una simulación. Si algún día se conecta una pasarela
 * real (anexo «Paso a producción real»), se quita poniéndolo a `false`.
 */
export const AVISO_PAGO_SIMULADO = true;

// Pasarela de pago simulado (DESIGN_SYSTEM §8.4, TECH_SPEC §11.1). Pide una
// tarjeta para parecerse a un pago real, pero solo comprueba su formato: los
// datos nunca salen del navegador, y `onPay` solo recibe el resultado elegido.
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

export function PaymentModal({ open, ...props }: PaymentModalProps) {
  // Se monta al abrir, para que cada intento empiece con la tarjeta vacía.
  return open ? <VentanaPago {...props} /> : null;
}

function VentanaPago({ concept, amount, processing, onPay, onClose }: Omit<PaymentModalProps, 'open'>) {
  const { t } = useTranslation();
  const esquema = useMemo(() => tarjetaSimuladaSchema(new Date()), []);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TarjetaSimuladaInput>({
    resolver: zodResolver(esquema),
    defaultValues: { holder: '', number: '', expiry: '', cvc: '' },
  });
  // Los datos validados se descartan: solo se pasa el resultado.
  const pagar = (outcome: SimulatedOutcome) => void handleSubmit(() => onPay(outcome))();

  return (
    <Modal
      open
      title={t('payment.title')}
      onClose={onClose}
      closable={!processing}
      footer={
        <>
          <Button variant="outline" disabled={processing} onClick={() => pagar('failure')}>
            {t('payment.fail')}
          </Button>
          <Button disabled={processing} onClick={() => pagar('success')}>
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
      {AVISO_PAGO_SIMULADO && (
        <Alert type="info">
          <p>{t('payment.cardWarning')}</p>
        </Alert>
      )}
      <div className={styles.card}>
        <TextField
          label={t('payment.cardHolder')}
          autoComplete="off"
          error={errors.holder?.message}
          {...register('holder')}
        />
        <TextField
          label={t('payment.cardNumber')}
          inputMode="numeric"
          autoComplete="off"
          help={AVISO_PAGO_SIMULADO ? t('payment.testCard') : undefined}
          error={errors.number?.message}
          {...register('number')}
        />
        <div className={styles.row}>
          <TextField
            label={t('payment.cardExpiry')}
            inputMode="numeric"
            autoComplete="off"
            error={errors.expiry?.message}
            {...register('expiry')}
          />
          <TextField
            label={t('payment.cardCvc')}
            inputMode="numeric"
            autoComplete="off"
            error={errors.cvc?.message}
            {...register('cvc')}
          />
        </div>
      </div>
    </Modal>
  );
}
