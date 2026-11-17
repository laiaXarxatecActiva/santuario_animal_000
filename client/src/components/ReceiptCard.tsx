import type { PaymentMethod } from '@sanctuary/shared';
import { useTranslation } from 'react-i18next';
import { formatCurrency, formatLongDate } from '../utils/format';
import { Badge } from './Badge';
import styles from './ReceiptCard.module.css';

// Recibo imprimible (DESIGN_SYSTEM §8.9): cuotas y donaciones (CU-19, CU-05).
export interface ReceiptCardProps {
  concept: string;
  amount: string;
  method: PaymentMethod;
  reference: string;
  /** Instante ISO del cobro. */
  paidAt: string;
  refundedAt: string | null;
  /** Quién paga; en una donación sin datos no se muestra. */
  payer: { fullName: string | null; email: string | null } | null;
  /** Nivel del título «Recibo»: h1 en su propia página, h2 dentro de otra. */
  titleAs?: 'h1' | 'h2';
}

export function ReceiptCard({
  concept,
  amount,
  method,
  reference,
  paidAt,
  refundedAt,
  payer,
  titleAs: Titulo = 'h1',
}: ReceiptCardProps) {
  const { t } = useTranslation();
  const conPagador = payer && (payer.fullName || payer.email);
  return (
    <article className={styles.receipt}>
      <header className={styles.header}>
        <div>
          <p className={styles.sanctuary}>{t('app.name')}</p>
          <p className={styles.muted}>{t('legal.academicNote')}</p>
        </div>
        <Titulo className={styles.title}>{t('receipt.title')}</Titulo>
      </header>
      <dl className={styles.data}>
        {conPagador && (
          <>
            <dt>{t('receipt.payer')}</dt>
            <dd>
              {payer.fullName && <span>{payer.fullName}</span>}
              {payer.fullName && payer.email && <br />}
              {payer.email && <span>{payer.email}</span>}
            </dd>
          </>
        )}
        <dt>{t('contributions.concept')}</dt>
        <dd>{concept}</dd>
        <dt>{t('contributions.amount')}</dt>
        <dd className={styles.amount}>{formatCurrency(amount)}</dd>
        <dt>{t('receipt.paidAt')}</dt>
        <dd>{formatLongDate(paidAt)}</dd>
        <dt>{t('receipt.method')}</dt>
        <dd>{t(`receipt.methods.${method}`)}</dd>
        <dt>{t('contributions.reference')}</dt>
        <dd>{reference}</dd>
        <dt>{t('contributions.status')}</dt>
        <dd>
          {refundedAt ? (
            <Badge tone="info">{t('receipt.refundedOn', { date: formatLongDate(refundedAt) })}</Badge>
          ) : (
            <Badge tone="success">{t('contributions.paymentStatus.completed')}</Badge>
          )}
        </dd>
      </dl>
      {method === 'simulated' && <p className={styles.notice}>{t('receipt.simulated')}</p>}
    </article>
  );
}
