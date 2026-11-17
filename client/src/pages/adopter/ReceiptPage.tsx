import { faPrint } from '@fortawesome/free-solid-svg-icons';
import type { ReceiptDto } from '@sanctuary/shared';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { Alert } from '../../components/Alert';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { CardSkeletons } from '../../components/CardSkeleton';
import { useReceipt } from '../../hooks/useContributions';
import { formatCurrency, formatLongDate, formatShortDate } from '../../utils/format';
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
      <article className={styles.receipt}>
        <header className={styles.header}>
          <div>
            <p className={styles.sanctuary}>{t('app.name')}</p>
            <p className={styles.muted}>{t('legal.academicNote')}</p>
          </div>
          <h1 className={styles.title}>{t('receipt.title')}</h1>
        </header>
        <dl className={styles.data}>
          <dt>{t('receipt.payer')}</dt>
          <dd>
            <span>{r.payer.fullName}</span>
            <br />
            <span>{r.payer.email}</span>
          </dd>
          <dt>{t('contributions.concept')}</dt>
          <dd>{concepto}</dd>
          <dt>{t('contributions.amount')}</dt>
          <dd className={styles.amount}>{formatCurrency(r.amount)}</dd>
          <dt>{t('receipt.paidAt')}</dt>
          <dd>{formatLongDate(r.paidAt)}</dd>
          <dt>{t('receipt.method')}</dt>
          <dd>{t(`receipt.methods.${r.method}`)}</dd>
          <dt>{t('contributions.reference')}</dt>
          <dd>{r.reference}</dd>
          <dt>{t('contributions.status')}</dt>
          <dd>
            {r.status === 'refunded' && r.refundedAt ? (
              <Badge tone="info">{t('receipt.refundedOn', { date: formatLongDate(r.refundedAt) })}</Badge>
            ) : (
              <Badge tone="success">{t('contributions.paymentStatus.completed')}</Badge>
            )}
          </dd>
        </dl>
        {r.method === 'simulated' && <p className={styles.notice}>{t('receipt.simulated')}</p>}
      </article>
    </div>
  );
}
