import { faPrint } from '@fortawesome/free-solid-svg-icons';
import type { ReceiptDto } from '@sanctuary/shared';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { CardSkeletons } from '../../components/CardSkeleton';
import { ReceiptCard } from '../../components/ReceiptCard';
import { useReceipt } from '../../hooks/useContributions';
import { formatShortDate } from '../../utils/format';
import styles from './ReceiptPage.module.css';

// CU-19 paso 5: recibo imprimible (en la Fase 3 será un PDF).
export function ReceiptPage() {
  const { t } = useTranslation();
  const params = useParams();
  const kind: ReceiptDto['kind'] = params.kind === 'donation' ? 'donation' : 'payment';
  const recibo = useReceipt(kind, Number(params.id));
  const volver = <Link to="/my-contributions">{t('receipt.back')}</Link>;

  if (recibo.isError || (params.kind !== 'payment' && params.kind !== 'donation')) {
    return (
      <div className="container">
        <Alert type="error" title={t('receipt.errorLoading')} action={volver} />
      </div>
    );
  }
  if (!recibo.data) {
    return (
      <div className="container">
        <CardSkeletons count={1} />
      </div>
    );
  }

  const r = recibo.data;
  let concepto = t('contributions.donation');
  if (r.kind === 'payment' && r.animalName && r.periodStart && r.periodEnd) {
    const periodo = { from: formatShortDate(r.periodStart), to: formatShortDate(r.periodEnd) };
    concepto = r.planName
      ? t('receipt.paymentConceptPlan', { name: r.animalName, plan: r.planName, ...periodo })
      : t('contributions.paymentConcept', { name: r.animalName, ...periodo });
  }

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.toolbar}>
        {volver}
        <Button variant="outline" icon={faPrint} onClick={() => window.print()}>
          {t('receipt.print')}
        </Button>
      </div>
      <ReceiptCard
        concept={concepto}
        amount={r.amount}
        method={r.method}
        reference={r.reference}
        paidAt={r.paidAt}
        refundedAt={r.status === 'refunded' ? r.refundedAt : null}
        payer={r.payer}
      />
    </div>
  );
}
