import { faReceipt } from '@fortawesome/free-solid-svg-icons';
import type { ContributionDonationDto, ContributionPaymentDto, PaymentStatus } from '@sanctuary/shared';
import { useId, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Alert } from '../../components/Alert';
import { Badge, type BadgeTone } from '../../components/Badge';
import { Button } from '../../components/Button';
import { CardSkeletons } from '../../components/CardSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { SelectField } from '../../components/FormFields';
import { useContributions } from '../../hooks/useContributions';
import { formatCurrency, formatShortDate, formatShortInstant } from '../../utils/format';
import tableStyles from '../admin/AdminPage.module.css';
import styles from './ContributionsPage.module.css';

// CU-19 Consultar mis aportaciones (SCREENS §4.5).
const TONOS: Record<PaymentStatus, BadgeTone> = {
  completed: 'success',
  failed: 'error',
  pending: 'warning',
  refunded: 'info',
};

type Pestana = 'payments' | 'donations';
const PESTANAS: Pestana[] = ['payments', 'donations'];

/** 4a: los fallidos y pendientes no tienen recibo. */
const tieneRecibo = (status: PaymentStatus) => status === 'completed' || status === 'refunded';

export function ContributionsPage() {
  const { t } = useTranslation();
  const [anio, setAnio] = useState<number | undefined>(undefined);
  const [pestana, setPestana] = useState<Pestana>('payments');
  const aportaciones = useContributions(anio);
  const base = useId();

  let contenido;
  if (aportaciones.isError) {
    contenido = (
      <Alert
        type="error"
        title={t('contributions.errorLoading')}
        action={
          <Button variant="outline" onClick={() => void aportaciones.refetch()}>
            {t('common.retry')}
          </Button>
        }
      />
    );
  } else if (!aportaciones.data) {
    contenido = <CardSkeletons count={2} />;
  } else {
    const { payments, donations, totals } = aportaciones.data;
    if (totals.years.length === 0 && payments.length === 0 && donations.length === 0 && anio === undefined) {
      contenido = <EmptyState icon={faReceipt} message={t('contributions.empty')} />;
    } else {
      // «Aportado en…»: el año elegido o, sin filtro, el más reciente con aportaciones.
      const anioResumen = anio ?? totals.years[0]?.year;
      const totalAnio = totals.years.find((y) => y.year === anioResumen)?.total ?? '0.00';
      const moverFoco = (e: KeyboardEvent<HTMLButtonElement>) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const siguiente = pestana === 'payments' ? 'donations' : 'payments';
        setPestana(siguiente);
        document.getElementById(`${base}-tab-${siguiente}`)?.focus();
      };
      contenido = (
        <>
          <div className={styles.summary}>
            {anioResumen !== undefined && (
              <div className={styles.summaryCard}>
                <span className={styles.figure}>{formatCurrency(totalAnio)}</span>
                <span>{t('contributions.yearTotal', { year: anioResumen })}</span>
              </div>
            )}
            <div className={styles.summaryCard}>
              <span className={styles.figure}>{formatCurrency(totals.allTime)}</span>
              <span>{t('contributions.allTime')}</span>
            </div>
          </div>

          <div className={styles.filters}>
            <SelectField
              label={t('contributions.year')}
              value={anio ?? ''}
              onChange={(e) => setAnio(e.target.value === '' ? undefined : Number(e.target.value))}
            >
              <option value="">{t('contributions.allYears')}</option>
              {totals.years.map((y) => (
                <option key={y.year} value={y.year}>
                  {y.year}
                </option>
              ))}
            </SelectField>
          </div>

          <div role="tablist" aria-label={t('contributions.title')} className={styles.tabs}>
            {PESTANAS.map((p) => (
              <button
                key={p}
                id={`${base}-tab-${p}`}
                type="button"
                role="tab"
                aria-selected={pestana === p}
                aria-controls={`${base}-panel-${p}`}
                tabIndex={pestana === p ? 0 : -1}
                className={styles.tab}
                onClick={() => setPestana(p)}
                onKeyDown={moverFoco}
              >
                {t(`contributions.tabs.${p}`)}
              </button>
            ))}
          </div>
          <div id={`${base}-panel-${pestana}`} role="tabpanel" aria-labelledby={`${base}-tab-${pestana}`}>
            {pestana === 'payments' ? <TablaCuotas cuotas={payments} /> : <TablaDonaciones donaciones={donations} />}
          </div>
        </>
      );
    }
  }

  return (
    <div className="container">
      <h1 className={styles.title}>{t('contributions.title')}</h1>
      {contenido}
    </div>
  );
}

function Cabecera() {
  const { t } = useTranslation();
  return (
    <thead>
      <tr>
        <th>{t('contributions.date')}</th>
        <th>{t('contributions.concept')}</th>
        <th className={tableStyles.numeric}>{t('contributions.amount')}</th>
        <th>{t('contributions.status')}</th>
        <th>{t('contributions.reference')}</th>
        <th>
          <span className="visually-hidden">{t('contributions.receipt')}</span>
        </th>
      </tr>
    </thead>
  );
}

function Fila({
  fecha,
  concepto,
  importe,
  status,
  referencia,
  recibo,
}: {
  fecha: string;
  concepto: string;
  importe: string;
  status: PaymentStatus;
  referencia: string;
  recibo: string;
}) {
  const { t } = useTranslation();
  return (
    <tr>
      <td data-label={t('contributions.date')} className={tableStyles.numeric}>
        {formatShortInstant(fecha)}
      </td>
      <td>
        <strong>{concepto}</strong>
      </td>
      <td data-label={t('contributions.amount')} className={tableStyles.numeric}>
        {formatCurrency(importe)}
      </td>
      <td data-label={t('contributions.status')}>
        <Badge tone={TONOS[status]}>{t(`contributions.paymentStatus.${status}`)}</Badge>
      </td>
      <td data-label={t('contributions.reference')} className={styles.reference}>
        {referencia}
      </td>
      <td>{tieneRecibo(status) && <Link to={recibo}>{t('contributions.receipt')}</Link>}</td>
    </tr>
  );
}

function TablaCuotas({ cuotas }: { cuotas: ContributionPaymentDto[] }) {
  const { t } = useTranslation();
  if (cuotas.length === 0) return <p className={styles.none}>{t('contributions.noPayments')}</p>;
  return (
    <table className={tableStyles.table}>
      <Cabecera />
      <tbody>
        {cuotas.map((c) => (
          <Fila
            key={c.id}
            fecha={c.date}
            concepto={t('contributions.paymentConcept', {
              name: c.animal.name,
              from: formatShortDate(c.periodStart),
              to: formatShortDate(c.periodEnd),
            })}
            importe={c.amount}
            status={c.status}
            referencia={c.reference}
            recibo={`/my-contributions/receipts/payment/${c.id}`}
          />
        ))}
      </tbody>
    </table>
  );
}

function TablaDonaciones({ donaciones }: { donaciones: ContributionDonationDto[] }) {
  const { t } = useTranslation();
  if (donaciones.length === 0) return <p className={styles.none}>{t('contributions.noDonations')}</p>;
  return (
    <table className={tableStyles.table}>
      <Cabecera />
      <tbody>
        {donaciones.map((d) => (
          <Fila
            key={d.id}
            fecha={d.date}
            concepto={t('contributions.donation')}
            importe={d.amount}
            status={d.status}
            referencia={d.reference}
            recibo={`/my-contributions/receipts/donation/${d.id}`}
          />
        ))}
      </tbody>
    </table>
  );
}
